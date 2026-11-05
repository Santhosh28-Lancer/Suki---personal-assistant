import { NativeModules, Platform } from 'react-native';

export type PickedPdf = {
  uri: string;
  name: string;
  size: number;
  type: 'application/pdf';
};

type NativePdfPicker = {
  pickPdf(): Promise<PickedPdf | null>;
  deleteTemporaryPdf(uri: string): Promise<boolean>;
};

export async function pickPdf(): Promise<PickedPdf | null> {
  if (Platform.OS !== 'android') {
    throw new Error('PDF attachment is currently available in the Android app only.');
  }
  const picker = NativeModules.SukiPdfPicker as NativePdfPicker | undefined;
  if (!picker?.pickPdf) {
    throw new Error('The PDF picker native module is missing. Rebuild and reinstall the Android app.');
  }
  return picker.pickPdf();
}

export async function deleteTemporaryPdf(uri: string): Promise<void> {
  const picker = NativeModules.SukiPdfPicker as NativePdfPicker | undefined;
  if (Platform.OS === 'android' && picker?.deleteTemporaryPdf) {
    await picker.deleteTemporaryPdf(uri);
  }
}
