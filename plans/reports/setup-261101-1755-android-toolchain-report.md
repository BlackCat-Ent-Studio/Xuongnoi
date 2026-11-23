# Android toolchain setup (2026-11-01)

| Item | Version | Path |
|---|---|---|
| Temurin JDK | 21.0.13+9 LTS | D:\android\jdk-21 |
| cmdline-tools | build 15859902 | D:\android\sdk\cmdline-tools\latest |
| platform-tools (adb) | 37.0.1 | D:\android\sdk\platform-tools |
| platform | android-35 (rev 2) | D:\android\sdk\platforms\android-35 |
| build-tools | 35.0.0 | D:\android\sdk\build-tools\35.0.0 |

- Android SDK licenses ACCEPTED via `yes | sdkmanager --licenses` (user approved).
- User env vars set: ANDROID_HOME, ANDROID_SDK_ROOT = D:\android\sdk. JAVA_HOME / system PATH untouched.
- Activate per shell: cmd `call D:\android\env.cmd`; PowerShell `. D:\android\env.ps1` (sets JAVA_HOME=jdk-21, prepends jdk bin, platform-tools, cmdline-tools).
- Verified: adb 1.0.41 (37.0.1) runs; java 21.0.13 via env.ps1; sdkmanager --list_installed shows 3 packages.
- Disk: D:\android total ~1.5 GB (includes pre-existing stuff below).
- Zips deleted.

Note: D:\android already held an older install from 2025-09-25 at root level (cmdline-tools, platforms/android-34, build-tools/34.0.0, _dl/jdk17.zip, cmdline-tools.zip). Left untouched. New toolchain is entirely under jdk-21 and sdk.
Note: sdkmanager prints a deprecation warning (Android CLI replacement); harmless. Under Git Bash pass `--sdk_root` in single quotes with single backslashes, else path is mangled.
