# Android emulator setup and acceptance

2026-10-21 current status: **INSTALLED; launch BLOCKED_PENDING_WINDOWS_RESTART.** The user freed disk space, raising observed free space from1.43GiB to36.71GiB before installation. Microsoft OpenJDK21.0.12.1, Google command-line tools, Android Emulator37.2.12, platform-tools and Google APIs Android36 x86_64 system image revision7 were downloaded/installed. Source SHA256 checks passed for Java and the command-line tools. AVD Traina_API_36 was created with a Pixel7 profile. Its generated numeric settings were normalized from Arabic digits to ASCII because emulator configuration keys require ASCII numbers.

Installed SDK: C:/Users/Ahmed/Documents/Codex/runtimes/android-sdk
AVD data: C:/Users/Ahmed/Documents/Codex/runtimes/android-avd
Java: C:/Users/Ahmed/Documents/Codex/2026-10-20/c-users-ahmed-desktop-app/work/android-tools/java/jdk-21.0.12.1+1

The emulator acceleration probe returned code6: Android Emulator hypervisor driver is not installed. A launch attempt also could not create C:/Users/Ahmed/.android in the agent execution environment, even after a targeted filesystem grant. It was stopped; no successful emulator boot, APK install or running Android app is claimed. The new Android CLI bootstrap also failed to create its bin directory; the official SDK manager fallback installed the packages successfully.

A concrete Windows administrator helper was prepared in the output package to create the preferences directory and enable Microsoft's HypervisorPlatform feature with NoRestart. The user was asked to run it in elevated PowerShell. Windows may require a restart and BIOS VT-x/AMD-V may also need enabling. No OS feature was enabled or reboot performed by this agent. Google references: https://developer.android.com/studio/run/emulator-acceleration and https://developer.android.com/tools/variables.

The repository script scripts/start-android-emulator.ps1 accepts SdkRoot, JavaRoot, AvdRoot and DeviceName, checks acceleration, opens the requested visible emulator and starts the installed project Expo CLI against the dedicated staging API. A machine-specific Start-Traina-Android.ps1 wrapper is supplied in outputs. It uses VS Code or any terminal; Android Studio itself is not required with these installed command-line tools.

The globally installed legacy expo-cli is not used. From apps/mobile, npm run start:staging explicitly configures https://traina-staging-api.vercel.app. Once an emulator is running, npm run start:staging -- --android can install/open the matching Expo Go runtime. Custom modules unavailable there need a development build. Optimized Hermes export is not an APK or native acceptance.

Acceptance: record device/API/runtime/commit, Arabic and English restart, mixed text/input, all customer routes, start/rapid sets/edit final set/rest/pause/resume/finish/history/restart/offline/reconnect. Reconcile backend results and capture screenshots/timed video, native heap/FPS/startup/input latency using synthetic accounts. Emulator results do not replace actual iPhone release-like acceptance.

## Confirmed Windows setup result

The user ran the administrator helper and reported: Windows Hypervisor Platform enabled; Restart required: True. The preferences folder was created and adb37.0.1 now starts successfully. A temporary software-only boot exposed emulator-5554 as offline and never reached a completed Android boot; it was stopped. Windows restart is now the concrete blocking action. No restart was performed automatically.

Expo Go57.0.9 for SDK57 was downloaded from the official Expo release (208916626 bytes) and verified against SHA25614c18828a3d04e43922245920bd941b978fd1c7a5aec88a0188032f0bb4972ce. This is the Expo runtime, not a Traina APK. Once Windows restarts, use the prepared Start-Traina-Android.ps1 output wrapper. Run acceleration check again; BIOS virtualization remains a conditional requirement if it fails.
