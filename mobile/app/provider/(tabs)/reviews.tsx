import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/app/screen';
import { ReceivedReviews } from '@/components/app/received-reviews';

export default function ProviderReviews() {
  const qc = useQueryClient();
  return (
    <Screen onRefresh={() => qc.invalidateQueries({ queryKey: ['reviews', 'received'] })}>
      <ReceivedReviews />
    </Screen>
  );
}
