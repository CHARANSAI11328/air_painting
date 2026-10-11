"""
================================================================================
NEON AIR STUDIO - Standalone Python Computer Vision Air Painter
Real-Time Hand Gesture Tracking with OpenCV & MediaPipe
================================================================================
"""

import os
import sys
import time
import math
import cv2
import numpy as np

try:
    import mediapipe as mp
except ImportError:
    print("MediaPipe not found! Please run: pip install mediapipe opencv-python")
    sys.exit(1)


class PythonAirPainter:
    def __init__(self):
        # MediaPipe Hands Setup (Dual Hands Enabled)
        self.mp_hands = mp.solutions.hands
        self.mp_draw = mp.solutions.drawing_utils
        self.hands = self.mp_hands.Hands(
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )

        # Video Capture Setup
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(1)

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        self.width = 1280
        self.height = 720

        # Canvases (Whiteboard / Canvas)
        self.canvas = np.zeros((self.height, self.width, 3), np.uint8)
        self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)
        self.is_whiteboard = True

        # Drawing Colors (BGR format)
        self.colors = [
            {"name": "CYAN", "bgr": (255, 243, 0), "rgb": (0, 243, 255)},
            {"name": "PURPLE", "bgr": (247, 85, 168), "rgb": (168, 85, 247)},
            {"name": "GREEN", "bgr": (129, 185, 16), "rgb": (16, 185, 129)},
            {"name": "PINK", "bgr": (153, 0, 236), "rgb": (236, 0, 153)},
            {"name": "YELLOW", "bgr": (21, 204, 250), "rgb": (250, 204, 21)},
            {"name": "WHITE", "bgr": (255, 255, 255), "rgb": (255, 255, 255)}
        ]
        self.color_idx = 0
        self.active_color = self.colors[self.color_idx]["bgr"]

        # Shapes & Tools
        self.shapes = ["FREEHAND", "LINE", "RECT", "CIRCLE"]
        self.shape_idx = 0
        self.active_shape = self.shapes[self.shape_idx]

        self.brush_size = 8
        self.eraser_size = 40
        self.is_eraser = False

        # Gesture & Pointer State
        self.prev_x, self.prev_y = 0, 0
        self.smoothed_x, self.smoothed_y = 0, 0
        self.shape_start = None

        # Dwell Selection Timing
        self.dwell_target = None
        self.dwell_start_time = 0
        self.dwell_duration = 0.7  # seconds

        # Shortcut Shape Auto-Stamping
        self.shortcut_type = None
        self.shortcut_start_time = 0
        self.shortcut_hold_time = 0.45  # seconds
        self.shortcut_cooldown = 0

        # Two-Hand Interactive Drawing State
        self.two_hand_active = False
        self.two_hand_path1 = []
        self.two_hand_path2 = []
        self.two_hand_start_p1 = None
        self.two_hand_start_p2 = None
        self.two_hand_has_separated = False
        self.two_hand_last_move = 0
        self.prev_eraser_x = 0
        self.prev_eraser_y = 0

        # Interactive UI Buttons Configuration
        self.buttons = []
        self.init_ui_buttons()

        # Feedback Toast
        self.toast_msg = "🤙 L: Square | 🤌 OK: Circle | 🤘 Horns: Star | ☝️: Paint"
        self.toast_expire = time.time() + 5.0

        # FPS
        self.prev_time = time.time()
        self.fps = 0

        # Save Directory
        self.save_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "captures")
        os.makedirs(self.save_dir, exist_ok=True)

    def init_ui_buttons(self):
        """Builds bounding boxes for top header toolbar buttons"""
        self.buttons = []
        x_offset = 20
        y_top = 10
        btn_h = 54

        # 1. Colors
        for i, col in enumerate(self.colors):
            w = 58
            self.buttons.append({
                "type": "color",
                "index": i,
                "label": col["name"],
                "color": col["bgr"],
                "rect": (x_offset, y_top, x_offset + w, y_top + btn_h)
            })
            x_offset += w + 8

        x_offset += 16

        # 2. Shapes
        for i, shp in enumerate(self.shapes):
            w = 88
            self.buttons.append({
                "type": "shape",
                "index": i,
                "shape": shp,
                "label": shp,
                "rect": (x_offset, y_top, x_offset + w, y_top + btn_h)
            })
            x_offset += w + 8

        x_offset += 16

        # 3. Actions: Eraser, Clear, Save
        actions = [
            {"type": "eraser", "label": "ERASER", "w": 85},
            {"type": "clear", "label": "CLEAR", "w": 75},
            {"type": "save", "label": "SAVE", "w": 75}
        ]
        for act in actions:
            self.buttons.append({
                "type": act["type"],
                "label": act["label"],
                "rect": (x_offset, y_top, x_offset + act["w"], y_top + btn_h)
            })
            x_offset += act["w"] + 8

    def show_toast(self, msg, duration=2.5):
        self.toast_msg = msg
        self.toast_expire = time.time() + duration

    def get_finger_status(self, landmarks):
        """Analyzes 21 landmarks to determine which fingers are up"""
        # [Thumb, Index, Middle, Ring, Pinky]
        fingers = []

        # Thumb (check x-distance relative to MCP in mirrored coordinates)
        if landmarks[4].x < landmarks[3].x:
            fingers.append(1)
        else:
            fingers.append(0)

        # 4 Fingers: Check if tip y is above pip y (smaller y is higher up)
        tips = [8, 12, 16, 20]
        pips = [6, 10, 14, 18]
        for tip, pip in zip(tips, pips):
            if landmarks[tip].y < landmarks[pip].y:
                fingers.append(1)
            else:
                fingers.append(0)

        return fingers

    def handle_pointer_hover(self, x, y):
        """Checks if fingertip is dwelling over a toolbar button"""
        hovered_btn = None
        for btn in self.buttons:
            x1, y1, x2, y2 = btn["rect"]
            if x1 <= x <= x2 and y1 <= y <= y2:
                hovered_btn = btn
                break

        now = time.time()
        if hovered_btn is not None:
            if self.dwell_target != hovered_btn:
                self.dwell_target = hovered_btn
                self.dwell_start_time = now

            elapsed = now - self.dwell_start_time
            progress = min(1.0, elapsed / self.dwell_duration)

            if progress >= 1.0:
                # Trigger Button Action!
                self.execute_button_action(hovered_btn)
                self.dwell_target = None
                self.dwell_start_time = 0
                return 0.0, hovered_btn

            return progress, hovered_btn
        else:
            self.dwell_target = None
            self.dwell_start_time = 0
            return 0.0, None

    def execute_button_action(self, btn):
        btype = btn["type"]
        if btype == "color":
            self.color_idx = btn["index"]
            self.active_color = self.colors[self.color_idx]["bgr"]
            self.is_eraser = False
            self.show_toast(f"Selected Color: {btn['label']}")

        elif btype == "shape":
            self.shape_idx = btn["index"]
            self.active_shape = self.shapes[self.shape_idx]
            self.is_eraser = False
            self.show_toast(f"Selected Tool: {btn['label']}")

        elif btype == "eraser":
            self.is_eraser = not self.is_eraser
            status = "ON" if self.is_eraser else "OFF"
            self.show_toast(f"Eraser {status}")

        elif btype == "clear":
            self.canvas = np.zeros((self.height, self.width, 3), np.uint8)
            self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)
            self.show_toast("Canvas Cleared!")

        elif btype == "save":
            self.save_artwork()

    def save_artwork(self):
        filename = f"air_painting_{int(time.time())}.png"
        filepath = os.path.join(self.save_dir, filename)
        cv2.imwrite(filepath, self.canvas)
        self.show_toast(f"Saved: {filename}")

    def draw_star(self, img, center, radius, color, thickness=2):
        cx, cy = center
        pts = []
        for i in range(10):
            r = radius if i % 2 == 0 else radius * 0.45
            ang = math.pi / 2 * 3 + i * (math.pi / 5)
            pts.append((int(cx + math.cos(ang) * r), int(cy + math.sin(ang) * r)))
        pts = np.array(pts, np.int32).reshape((-1, 1, 2))
        cv2.polylines(img, [pts], True, color, thickness, cv2.LINE_AA)

    def draw_heart(self, img, center, radius, color, thickness=2):
        cx, cy = center
        pts = []
        for t in np.linspace(0, 2 * math.pi, 60):
            x = 16 * (math.sin(t) ** 3)
            y = -(13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t))
            scale = radius / 18.0
            pts.append((int(cx + x * scale), int(cy + y * scale)))
        pts = np.array(pts, np.int32).reshape((-1, 1, 2))
        cv2.polylines(img, [pts], True, color, thickness, cv2.LINE_AA)

    def stamp_shape(self, img, center, radius, shape, color, thickness=3):
        cx, cy = center
        r = max(25, int(radius))
        if shape == "SQUARE":
            cv2.rectangle(img, (cx - r, cy - r), (cx + r, cy + r), color, thickness, cv2.LINE_AA)
        elif shape == "CIRCLE":
            cv2.circle(img, (cx, cy), r, color, thickness, cv2.LINE_AA)
        elif shape == "STAR":
            self.draw_star(img, (cx, cy), r, color, thickness)
        elif shape == "HEART":
            self.draw_heart(img, (cx, cy), r, color, thickness)

    def draw_top_toolbar(self, frame):
        """Renders futuristic cyberpunk HUD top toolbar onto frame"""
        # Header glassmorphism background strip
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (self.width, 74), (20, 24, 38), -1)
        # Secondary shortcut hints ribbon
        cv2.rectangle(overlay, (0, 74), (self.width, 102), (14, 17, 28), -1)
        cv2.addWeighted(overlay, 0.88, frame, 0.12, 0, frame)

        cv2.line(frame, (0, 74), (self.width, 74), (0, 243, 255), 1)
        cv2.line(frame, (0, 102), (self.width, 102), (0, 243, 255), 1)

        # Shortcuts Ribbon Text
        ribbon_text = "SHORTCUTS: [L-Pose: Square]   [OK-Sign: Circle]   [Horns: Star]   [Shaka: Heart]   [2-Fingers: Select]   [1-Finger: Paint]"
        cv2.putText(frame, ribbon_text, (20, 93), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (0, 243, 255), 1, cv2.LINE_AA)

        for btn in self.buttons:
            x1, y1, x2, y2 = btn["rect"]
            btype = btn["type"]
            is_active = False

            if btype == "color" and not self.is_eraser and self.color_idx == btn["index"]:
                is_active = True
            elif btype == "shape" and not self.is_eraser and self.shape_idx == btn["index"]:
                is_active = True
            elif btype == "eraser" and self.is_eraser:
                is_active = True

            # Draw button background
            if is_active:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (60, 70, 95), -1)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 243, 255), 2)
            else:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (35, 42, 60), -1)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (80, 90, 110), 1)

            # Button Content
            if btype == "color":
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
                cv2.circle(frame, (cx, cy), 16, btn["color"], -1)
                if is_active:
                    cv2.circle(frame, (cx, cy), 18, (255, 255, 255), 2)
            else:
                text = btn["label"]
                text_color = (0, 243, 255) if is_active else (220, 225, 235)
                font_scale = 0.52 if len(text) <= 5 else 0.44
                (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
                tx = x1 + (x2 - x1 - tw) // 2
                ty = y1 + (y2 - y1 + th) // 2
                cv2.putText(frame, text, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_color, 1, cv2.LINE_AA)

    def run(self):
        print("=" * 60)
        print("  NEON AIR STUDIO (Python Computer Vision Edition)")
        print("  Controls:")
        print("  - Index Finger Only: Paint on Screen")
        print("  - Index + Middle Finger: Pointer Hover / Select Toolbar")
        print("  - 's' Key: Save Image Snapshot")
        print("  - 'c' Key: Clear Canvas")
        print("  - 'q' Key / ESC: Quit")
        print("=" * 60)

        while True:
            success, frame = self.cap.read()
            if not success:
                print("Failed to grab camera frame. Exiting...")
                break

            # Flip camera horizontally for mirror effect
            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            self.width, self.height = w, h

            # Process MediaPipe Hand Tracking
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.hands.process(rgb_frame)

            gesture_mode = "SEARCHING"
            dwell_progress = 0.0

            if results.multiHandLandmarks:
                now = time.time()
                # -------------------------------------------------------------
                # CASE A: DUAL HANDS DETECTED (👐 Two-Hand Dual Index Sculptor)
                # -------------------------------------------------------------
                if len(results.multiHandLandmarks) >= 2:
                    gesture_mode = "2 HANDS: SCULPT SHAPE"
                    self.prev_eraser_x, self.prev_eraser_y = 0, 0
                    self.prev_x, self.prev_y = 0, 0

                    h1 = results.multiHandLandmarks[0].landmark
                    h2 = results.multiHandLandmarks[1].landmark

                    raw_p1 = (int(h1[8].x * w), int(h1[8].y * h))
                    raw_p2 = (int(h2[8].x * w), int(h2[8].y * h))

                    # Ensure consistent left and right pointers
                    if raw_p1[0] <= raw_p2[0]:
                        p1, p2 = raw_p1, raw_p2
                    else:
                        p1, p2 = raw_p2, raw_p1

                    dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])

                    # Draw skeletons for both hands
                    for h_lms in results.multiHandLandmarks[:2]:
                        self.mp_draw.draw_landmarks(frame, h_lms, self.mp_hands.HAND_CONNECTIONS)

                    # Manage two-hand stroke recording
                    if not self.two_hand_active:
                        self.two_hand_active = True
                        self.two_hand_start_p1 = p1
                        self.two_hand_start_p2 = p2
                        self.two_hand_path1 = [p1]
                        self.two_hand_path2 = [p2]
                        self.two_hand_has_separated = dist > 70
                        self.two_hand_last_move = now
                    else:
                        last1 = self.two_hand_path1[-1]
                        last2 = self.two_hand_path2[-1]
                        m1 = math.hypot(p1[0] - last1[0], p1[1] - last1[1])
                        m2 = math.hypot(p2[0] - last2[0], p2[1] - last2[1])
                        if m1 > 4: self.two_hand_path1.append(p1)
                        if m2 > 4: self.two_hand_path2.append(p2)
                        if m1 > 4 or m2 > 4: self.two_hand_last_move = now
                        if dist > 70: self.two_hand_has_separated = True

                    # Live dotted/dashed shape preview on preview_canvas
                    self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)

                    # Draw path 1
                    for i in range(1, len(self.two_hand_path1)):
                        if i % 2 == 1:
                            cv2.line(self.preview_canvas, self.two_hand_path1[i-1], self.two_hand_path1[i], (0, 243, 255), 2, cv2.LINE_AA)

                    # Draw path 2
                    for i in range(1, len(self.two_hand_path2)):
                        if i % 2 == 1:
                            cv2.line(self.preview_canvas, self.two_hand_path2[i-1], self.two_hand_path2[i], (168, 85, 247), 2, cv2.LINE_AA)

                    # Top and bottom connections
                    if self.two_hand_start_p1 and self.two_hand_start_p2:
                        cv2.line(self.preview_canvas, self.two_hand_start_p1, self.two_hand_start_p2, (0, 243, 255), 2, cv2.LINE_AA)
                    cv2.line(self.preview_canvas, p1, p2, (0, 243, 255), 2, cv2.LINE_AA)

                    cv2.circle(frame, p1, 12, (0, 243, 255), 2)
                    cv2.circle(frame, p2, 12, (168, 85, 247), 2)

                    they_meet = self.two_hand_has_separated and dist < 45 and (len(self.two_hand_path1) > 4 or len(self.two_hand_path2) > 4)
                    steady_duration = now - self.two_hand_last_move
                    steady_finish = (len(self.two_hand_path1) > 6 or len(self.two_hand_path2) > 6) and steady_duration > 0.7

                    if (they_meet or steady_finish) and now > self.shortcut_cooldown:
                        pts = []
                        pts.extend(self.two_hand_path1)
                        if not they_meet:
                            pts.append(p2)
                        pts.extend(reversed(self.two_hand_path2))
                        if len(pts) >= 3:
                            poly_pts = np.array(pts, np.int32).reshape((-1, 1, 2))
                            cv2.polylines(self.canvas, [poly_pts], isClosed=True, color=self.active_color, thickness=self.brush_size, lineType=cv2.LINE_AA)
                        self.shortcut_cooldown = now + 0.8
                        self.two_hand_active = False
                        self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)
                        self.show_toast("2-Hand Closed Shape Placed!" if they_meet else "2-Hand Shape Placed!")

                # -------------------------------------------------------------
                # CASE B: SINGLE HAND DETECTED
                # -------------------------------------------------------------
                else:
                    # Reset two-hand session if active
                    if self.two_hand_active:
                        self.two_hand_active = False
                        self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)

                    hand_landmarks = results.multiHandLandmarks[0]
                    self.mp_draw.draw_landmarks(frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)

                    lm_list = hand_landmarks.landmark
                    fingers = self.get_finger_status(lm_list)

                    raw_x = int(lm_list[8].x * w)
                    raw_y = int(lm_list[8].y * h)

                    if self.smoothed_x == 0 and self.smoothed_y == 0:
                        self.smoothed_x, self.smoothed_y = raw_x, raw_y
                    else:
                        alpha = 0.45
                        self.smoothed_x = int(alpha * raw_x + (1 - alpha) * self.smoothed_x)
                        self.smoothed_y = int(alpha * raw_y + (1 - alpha) * self.smoothed_y)

                    curr_x, curr_y = self.smoothed_x, self.smoothed_y

                    # 1. CLOSED FIST -> WIPE CANVAS
                    if fingers == [0, 0, 0, 0, 0]:
                        gesture_mode = "CLOSED FIST: HOLD TO WIPE"
                        self.prev_eraser_x, self.prev_eraser_y = 0, 0
                        self.prev_x, self.prev_y = 0, 0

                        if self.shortcut_start_time == 0:
                            self.shortcut_start_time = now
                        elapsed = now - self.shortcut_start_time
                        cv2.circle(frame, (curr_x, curr_y), 40, (0, 0, 255), 3)
                        cv2.putText(frame, f"WIPING: {int(min(1.0, elapsed/0.8)*100)}%",
                                    (curr_x - 45, curr_y - 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                        if elapsed >= 0.8:
                            self.canvas = np.zeros((self.height, self.width, 3), np.uint8)
                            self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)
                            self.shortcut_start_time = 0
                            self.show_toast("Canvas Wiped Clean!")

                    # 2. TWO FINGERS (Index + Middle) -> CONTINUOUS VIRTUAL ERASER
                    elif fingers[1] == 1 and fingers[2] == 1 and fingers[3] == 0 and fingers[4] == 0:
                        gesture_mode = "2 FINGERS: ERASER"
                        self.shortcut_start_time = 0
                        self.prev_x, self.prev_y = 0, 0

                        # Check toolbar hover if high up
                        if curr_y < 105:
                            dwell_progress, _ = self.handle_pointer_hover(curr_x, curr_y)
                            cv2.circle(frame, (curr_x, curr_y), 14, (0, 243, 255), 2)
                            self.prev_eraser_x, self.prev_eraser_y = 0, 0
                        else:
                            # Erase strokes continuously with zero gaps
                            eraser_r = 38
                            if self.prev_eraser_x != 0 and self.prev_eraser_y != 0:
                                cv2.line(self.canvas, (self.prev_eraser_x, self.prev_eraser_y), (curr_x, curr_y), (0, 0, 0), eraser_r * 2, cv2.LINE_AA)
                            cv2.circle(self.canvas, (curr_x, curr_y), eraser_r, (0, 0, 0), -1)
                            self.prev_eraser_x, self.prev_eraser_y = curr_x, curr_y
                            cv2.circle(frame, (curr_x, curr_y), eraser_r, (0, 0, 255), 2)

                    # 3. SINGLE FINGER (Index Only) -> PURE LINE DRAWING (ZERO SHAPES)
                    elif fingers[1] == 1 and fingers[2] == 0 and fingers[3] == 0 and fingers[4] == 0:
                        gesture_mode = "1 FINGER: DRAWING"
                        self.shortcut_start_time = 0
                        self.prev_eraser_x, self.prev_eraser_y = 0, 0

                        if curr_y > 105:
                            if self.prev_x == 0 and self.prev_y == 0:
                                self.prev_x, self.prev_y = curr_x, curr_y

                            cv2.line(self.canvas, (self.prev_x, self.prev_y), (curr_x, curr_y), self.active_color, self.brush_size, cv2.LINE_AA)
                            self.prev_x, self.prev_y = curr_x, curr_y
                            cv2.circle(frame, (curr_x, curr_y), self.brush_size + 2, (255, 255, 255), 2)
                        else:
                            self.prev_x, self.prev_y = 0, 0

                    else:
                        self.shortcut_start_time = 0
                        self.prev_x, self.prev_y = 0, 0
                        gesture_mode = "HOVER / STANDBY"
            else:
                self.prev_x, self.prev_y = 0, 0
                self.shape_start = None
                self.dwell_target = None

            # Blend Permanent Canvas onto Frame
            gray = cv2.cvtColor(self.canvas, cv2.COLOR_BGR2GRAY)
            _, inv_mask = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY_INV)
            inv_mask = cv2.cvtColor(inv_mask, cv2.COLOR_GRAY2BGR)

            frame = cv2.bitwise_and(frame, inv_mask)
            frame = cv2.bitwise_or(frame, self.canvas)

            # Blend Preview Canvas (for Shapes)
            if self.shape_start is not None:
                preview_gray = cv2.cvtColor(self.preview_canvas, cv2.COLOR_BGR2GRAY)
                _, p_mask = cv2.threshold(preview_gray, 10, 255, cv2.THRESH_BINARY)
                p_mask = cv2.cvtColor(p_mask, cv2.COLOR_GRAY2BGR)
                frame = cv2.bitwise_or(frame, self.preview_canvas)

            # Draw Toolbar
            self.draw_top_toolbar(frame)

            # Status Banner & FPS
            curr_time = time.time()
            self.fps = int(1.0 / (curr_time - self.prev_time + 1e-6))
            self.prev_time = curr_time

            cv2.putText(frame, f"MODE: {gesture_mode}  |  {self.fps} FPS", (24, self.height - 24),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 243, 255), 1, cv2.LINE_AA)

            # Toast Notification
            if time.time() < self.toast_expire:
                (tw, th), _ = cv2.getTextSize(self.toast_msg, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
                bx = (self.width - tw) // 2
                by = self.height - 40
                cv2.rectangle(frame, (bx - 14, by - th - 10), (bx + tw + 14, by + 10), (14, 18, 30), -1)
                cv2.rectangle(frame, (bx - 14, by - th - 10), (bx + tw + 14, by + 10), (0, 243, 255), 1)
                cv2.putText(frame, self.toast_msg, (bx, by), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)

            # Display
            cv2.imshow("NEON AIR STUDIO - Computer Vision Air Painter", frame)

            # Keyboard Shortcuts
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:
                break
            elif key == ord('c'):
                self.canvas = np.zeros((self.height, self.width, 3), np.uint8)
                self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)
                self.show_toast("Canvas Cleared!")
            elif key == ord('s'):
                self.save_artwork()
            elif key == ord('e'):
                self.is_eraser = not self.is_eraser
                self.show_toast("Eraser Toggled")

        self.cap.release()
        cv2.destroyAllWindows()

    def draw_shape(self, target_canvas, p1, p2, shape, color, size):
        if shape == "LINE":
            cv2.line(target_canvas, p1, p2, color, size, cv2.LINE_AA)
        elif shape == "RECT":
            cv2.rectangle(target_canvas, p1, p2, color, size, cv2.LINE_AA)
        elif shape == "CIRCLE":
            radius = int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]))
            cv2.circle(target_canvas, p1, radius, color, size, cv2.LINE_AA)

    def finalize_shape(self, x, y):
        if self.shape_start and self.active_shape != "FREEHAND":
            color = (0, 0, 0) if self.is_eraser else self.active_color
            size = self.eraser_size if self.is_eraser else self.brush_size
            self.draw_shape(self.canvas, self.shape_start, (x, y), self.active_shape, color, size)
            self.preview_canvas = np.zeros((self.height, self.width, 3), np.uint8)
        self.shape_start = None


if __name__ == "__main__":
    app = PythonAirPainter()
    app.run()
