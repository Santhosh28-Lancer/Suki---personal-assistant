$ErrorActionPreference = 'Stop'
# Run from the mobile directory. Install SDK-matched native Expo packages first.
npx.cmd expo install expo-sqlite expo-image-picker expo-sharing expo-file-system
npm.cmd install xlsx expo-speech-recognition @react-native-ml-kit/text-recognition
npx.cmd expo prebuild --clean --platform android
Write-Host 'Native dependencies installed. Configure .env and run: npx.cmd expo run:android' -ForegroundColor Green
