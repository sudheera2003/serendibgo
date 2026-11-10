import * as React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { ChipSelect, Field } from '@/components/app/form';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const TYPES = [
  { value: 'booking', label: 'A booking' },
  { value: 'order', label: 'An order' },
  { value: 'provider', label: 'A provider' },
  { value: 'vendor', label: 'An artisan' },
  { value: 'other', label: 'Something else' },
];

export default function NewComplaint() {
  const params = useLocalSearchParams<{ targetType?: string; targetId?: string }>();
  const qc = useQueryClient();
  const [type, setType] = React.useState(params.targetType ?? 'other');
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');

  const send = useMutation({
    mutationFn: () => api.post('/complaints', { targetType: type, targetId: params.targetId ? Number(params.targetId) : undefined, subject, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      toast.success('Complaint submitted', 'An administrator will review it and reply here.');
      router.back();
    },
    onError: (e) => toast.error(e),
  });

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => send.mutate()} disabled={subject.trim().length < 3 || description.trim().length < 10 || send.isPending}>
          <Text>Submit complaint</Text>
        </Button>
      }>
      <Field label="What is it about?">
        <ChipSelect options={TYPES} value={type} onChange={setType} scroll={false} />
      </Field>
      {params.targetId ? (
        <Text variant="muted" className="text-sm">
          Linked to {params.targetType} #{params.targetId}
        </Text>
      ) : null}
      <Field label="Subject">
        <Input value={subject} onChangeText={setSubject} placeholder="Short summary" maxLength={150} />
      </Field>
      <Field label="What happened?" hint="At least 10 characters">
        <Textarea value={description} onChangeText={setDescription} placeholder="Describe the problem with dates and details" maxLength={3000} />
      </Field>
    </Screen>
  );
}
