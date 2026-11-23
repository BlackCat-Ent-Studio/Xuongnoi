# Brainstorm 261116-1540 — direction: robot / automation simulation (research, no decision yet)

## Inputs
- Client feedback (Zalo): (1) need business direction: which segment, which pain points, why worth trying, edge vs similar solutions; think user/market. (2) via Trí/anh Hoàng: "huge potential if it becomes a platform"; could go into international schools teaching kids thinking / robot programming.
- User wish: full logic for engineering simulation of automated machines (robots, arms, autonomous vehicles, drones…), pieces complete enough to rebuild them, sim designs usable for real work; priority robots/automation bots, controllable.
- Links (Facebook, only titles readable without login): reel "Lập trình robot dò đường | Cơ Điện Tử Việt Nam" (line-following robot); video "Học Scratch thú vị hơn bạn tưởng" (Scratch block programming). Video content itself NOT seen.

## Engine today (scout)
- 57 node kinds; custom simple physics (world/physics.ts: boxes, gravity, collision, carry); three.js only, no rigid-body engine (no rapier/cannon).
- Has: sensors (touch, zone, distance, ahead ray, vision, colour under feet, speed), logic/math, timer/counter, brains (go-to, route, patrol, chase), vehicles, conveyor, trains, step run.
- Missing for engineering: motors/wheels as actuators (differential drive), joints/servos/linkages, PID, encoders/IMU/line sensor array, real units (m, kg, N, V), rigid-body dynamics, arm kinematics, thrust/flight, signal plots, export to real controller code.

## Market notes (web, 2026)
- VN: VEX Robotics VN 2026 >200 teams, 14 to Worlds; new national Robotics championship 2026–27 (NSSC + SEPA); STEM tied to Resolution 57; theory–practice gap noted. No market-size figure found.
- Competitors: VEXcode VR (browser, blocks+Python, free / $199 / $499 per educator-year, tied to VEX), Open Roberta (open source, blocks, real kits), RoboScape Online, Rocksi (Blockly arm), Tinkercad Circuits (free electronics), Wokwi (Arduino/ESP32 sim), pro tools Webots/Gazebo/Isaac/CoppeliaSim/RobotStudio (heavy, expert).
- Gap seen: no Vietnamese, browser, wire-logic (dataflow) robot sim with authoring tool + step-run signal view.

## Honest feasibility
- "Sim design applies to real": realistic for CONTROL LOGIC (export to Arduino/ESP32/micro:bit), not for mechanical design accuracy. Engineer-grade digital twin = different league (Isaac/Gazebo), not recommended as first target.
- Arms/drones need a real rigid-body engine (e.g. Rapier) = big engine change; line-follower/AGV fit current engine with small additions.

## Proposed phases (not approved)
1. Robot dò đường pack: differential-drive robot (2 motors), line sensor (L/C/R), ultrasonic distance, PID piece, drawable track, signal plot; Xưởng Bot course "Robot dò đường"; teacher can author in Xưởng Nối.
2. Real link: export wiring → code for one kit (Arduino / ESP32 / micro:bit), same pin names.
3. Physics upgrade (Rapier): joints, servo, robot arm, warehouse AGV; then drone (thrust, IMU, PID).
4. Platform: accounts, classes, share/publish levels.

## Unresolved
- Target segment (schools/STEM centres vs vocational/university vs industry).
- Which real kit to match first.
- Age band; pricing model; who answers the client's business questions.
