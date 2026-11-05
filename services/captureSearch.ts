import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Sharing from 'expo-sharing';

export type CaptureSearchResult =
  | { cancelled: true }
  | { cancelled: false; imageShared: true; recognizedText: string | null };

/**
 * Captures an image and opens Android's native share sheet with the actual
 * image file. The user can choose Google Lens or another visual-search app.
 * OCR is best-effort and never blocks visual sharing when no text is present.
 */
export async function captureAndSearch(): Promise<CaptureSearchResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required for Capture to Search.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.95,
    allowsEditing: false,
  });

  const imageUri = result.assets?.[0]?.uri;
  if (result.canceled || !imageUri) return { cancelled: true };

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Image sharing is unavailable on this device.');
  }

  // Share the original captured image, not an OCR string or a search URL.
  // Android's chooser exposes compatible targets such as Google Lens.
  await Sharing.shareAsync(imageUri, {
    mimeType: 'image/jpeg',
    dialogTitle: 'Search this image with',
    UTI: 'public.jpeg',
  });

  let recognizedText: string | null = null;
  try {
    const recognized = await TextRecognition.recognize(imageUri);
    const text = recognized.text?.trim();
    if (text) recognizedText = text;
  } catch {
    // Visual search remains successful even if OCR fails.
  }

  return { cancelled: false, imageShared: true, recognizedText };
}
