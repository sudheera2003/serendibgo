import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ImagePlusIcon, XIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { uploadFile } from '@/lib/api';
import { toast } from '@/lib/toast';

/** Picks images from the gallery and uploads them; `value` holds the uploaded URLs. */
export function ImageUpload({ value, onChange, max = 1, label = 'Add photo' }: { value: string[]; onChange: (urls: string[]) => void; max?: number; label?: string }) {
  const [busy, setBusy] = React.useState(false);
  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.info('Photo access needed', 'Allow access to your photos in settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (res.canceled || !res.assets[0]) return;
    setBusy(true);
    try {
      const a = res.assets[0];
      const url = await uploadFile({ uri: a.uri, name: a.fileName ?? undefined, mimeType: a.mimeType });
      onChange([...value, url].slice(0, max));
    } catch (e) {
      toast.error(e, 'Upload failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="flex-row flex-wrap gap-3">
      {value.map((url) => (
        <View key={url} className="h-24 w-24 overflow-hidden rounded-lg border border-border">
          <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <Pressable onPress={() => onChange(value.filter((u) => u !== url))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1" accessibilityLabel="Remove photo">
            <Icon as={XIcon} size={12} className="text-white" />
          </Pressable>
        </View>
      ))}
      {value.length < max ? (
        <Pressable onPress={pick} disabled={busy} className="h-24 w-24 items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/40">
          {busy ? <ActivityIndicator /> : <Icon as={ImagePlusIcon} size={22} className="text-muted-foreground" />}
          <Text variant="muted" className="text-center text-[11px]">
            {busy ? 'Uploading…' : label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
