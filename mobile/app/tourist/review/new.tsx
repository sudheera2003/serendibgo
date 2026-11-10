import * as React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { StarInput, VerifiedBadge } from '@/components/app/bits';
import { Field } from '@/components/app/form';
import { ImageUpload } from '@/components/app/image-upload';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function NewReview() {
  const { type, id, title } = useLocalSearchParams<{ type: 'booking' | 'order_item' | 'checkin'; id: string; title?: string }>();
  const qc = useQueryClient();
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);

  const submit = useMutation({
    mutationFn: () => api.post('/reviews', { source: { type, id: Number(id) }, rating, comment: comment.trim() || undefined, photoUrls: photos.length ? photos : undefined }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success('Thank you!', 'Your verified review is now live.');
      router.back();
    },
    onError: (e) => toast.error(e, 'Could not post the review'),
  });

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => submit.mutate()} disabled={!rating || submit.isPending}>
          <Text>{submit.isPending ? 'Posting…' : 'Post review'}</Text>
        </Button>
      }>
      <View className="items-center gap-2 py-2">
        <Text className="text-center text-xl font-bold">{title || 'Your experience'}</Text>
        <VerifiedBadge label={type === 'checkin' ? 'GPS-verified visit' : type === 'order_item' ? 'Verified purchase' : 'Verified booking'} />
      </View>
      <View className="items-center gap-2">
        <StarInput value={rating} onChange={setRating} />
        <Text variant="muted">{rating ? LABELS[rating] : 'Tap to rate'}</Text>
      </View>
      <Field label="Tell other travellers about it (optional)">
        <Textarea value={comment} onChangeText={setComment} placeholder="What did you enjoy? What could be better?" maxLength={2000} />
      </Field>
      <Field label="Photos (optional)">
        <ImageUpload value={photos} onChange={setPhotos} max={4} />
      </Field>
      <Text variant="muted" className="text-xs">
        Reviews are public and linked to your real booking, purchase or visit. Please keep them honest and respectful.
      </Text>
    </Screen>
  );
}
