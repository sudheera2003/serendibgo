import * as React from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { ChipSelect, Field } from '@/components/app/form';
import { ImageUpload } from '@/components/app/image-upload';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { refreshMe } from '@/lib/session';
import { toast } from '@/lib/toast';

const TYPES = [
  { value: 'guide', label: 'Tour guide' },
  { value: 'tour_operator', label: 'Tour operator' },
  { value: 'vehicle_owner', label: 'Vehicle owner' },
] as const;

export default function ProviderApplication() {
  const p = useAuth((s) => s.user?.providerProfile);
  const [providerType, setType] = React.useState<(typeof TYPES)[number]['value']>(p?.providerType ?? 'guide');
  const [businessName, setName] = React.useState(p?.businessName ?? '');
  const [licenceNo, setLicence] = React.useState(p?.licenceNo ?? '');
  const [description, setDescription] = React.useState(p?.description ?? '');
  const [docs, setDocs] = React.useState<string[]>([]);
  const approved = p?.verificationStatus === 'approved';

  const submit = useMutation({
    mutationFn: () =>
      api.post('/users/me/provider-application', {
        providerType,
        businessName,
        licenceNo: licenceNo || undefined,
        description: description || undefined,
        documents: docs.map((fileUrl, i) => ({ docType: i === 0 ? 'Licence' : 'Supporting document', fileUrl })),
      }),
    onSuccess: async () => {
      await refreshMe();
      toast.success('Application submitted', 'We will notify you once an administrator has reviewed it.');
      router.back();
    },
    onError: (e) => toast.error(e),
  });

  return (
    <Screen
      footer={
        approved ? undefined : (
          <Button size="lg" onPress={() => submit.mutate()} disabled={businessName.trim().length < 2 || submit.isPending}>
            <Text>{submit.isPending ? 'Submitting…' : p ? 'Resubmit for verification' : 'Submit for verification'}</Text>
          </Button>
        )
      }>
      {p ? <StatusBadge status={p.verificationStatus} plain /> : null}
      <Text variant="muted">
        Tourists only see verified providers. Licensed guides should include their SLTDA licence number. Approved details can only be changed by contacting an administrator.
      </Text>
      <Field label="I am a">
        <ChipSelect options={[...TYPES]} value={providerType} onChange={setType} scroll={false} />
      </Field>
      <Field label="Business or trading name">
        <Input value={businessName} onChangeText={setName} editable={!approved} />
      </Field>
      <Field label="Licence / registration number" hint="e.g. SLTDA guide licence or business registration">
        <Input value={licenceNo} onChangeText={setLicence} editable={!approved} autoCapitalize="characters" />
      </Field>
      <Field label="About your service">
        <Textarea value={description} onChangeText={setDescription} editable={!approved} placeholder="Languages, experience, areas covered…" />
      </Field>
      {!approved ? (
        <Field label="Photos of your licence or documents" hint="Clear photos help us verify you faster.">
          <ImageUpload value={docs} onChange={setDocs} max={3} label="Add document" />
        </Field>
      ) : null}
    </Screen>
  );
}
