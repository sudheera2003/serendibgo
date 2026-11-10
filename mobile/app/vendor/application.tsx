import * as React from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { Field } from '@/components/app/form';
import { ImageUpload } from '@/components/app/image-upload';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { refreshMe } from '@/lib/session';
import { toast } from '@/lib/toast';

export default function VendorApplication() {
  const v = useAuth((s) => s.user?.vendorProfile);
  const [shopName, setShopName] = React.useState(v?.shopName ?? '');
  const [description, setDescription] = React.useState(v?.description ?? '');
  const [address, setAddress] = React.useState(v?.address ?? '');
  const [district, setDistrict] = React.useState(v?.district ?? '');
  const [docs, setDocs] = React.useState<string[]>([]);
  const approved = v?.verificationStatus === 'approved';

  const submit = useMutation({
    mutationFn: () =>
      api.post('/users/me/vendor-application', {
        shopName,
        description: description || undefined,
        address: address || undefined,
        district: district || undefined,
        documents: docs.map((fileUrl) => ({ docType: 'Business document', fileUrl })),
      }),
    onSuccess: async () => {
      await refreshMe();
      toast.success('Application submitted', 'We will notify you once your shop is verified.');
      router.back();
    },
    onError: (e) => toast.error(e),
  });

  return (
    <Screen
      footer={
        approved ? undefined : (
          <Button size="lg" onPress={() => submit.mutate()} disabled={shopName.trim().length < 2 || submit.isPending}>
            <Text>{v ? 'Resubmit for verification' : 'Submit for verification'}</Text>
          </Button>
        )
      }>
      {v ? <StatusBadge status={v.verificationStatus} plain /> : null}
      <Text variant="muted">Tourists only buy from verified artisans. Tell us about your shop and what you make.</Text>
      <Field label="Shop name">
        <Input value={shopName} onChangeText={setShopName} editable={!approved} />
      </Field>
      <Field label="About your products">
        <Textarea value={description} onChangeText={setDescription} editable={!approved} placeholder="Traditional techniques, materials, your story…" />
      </Field>
      <Field label="Address">
        <Input value={address} onChangeText={setAddress} editable={!approved} />
      </Field>
      <Field label="District">
        <Input value={district} onChangeText={setDistrict} editable={!approved} placeholder="e.g. Kandy" />
      </Field>
      {!approved ? (
        <Field label="Business registration or craft certificate (photo)">
          <ImageUpload value={docs} onChange={setDocs} max={3} label="Add document" />
        </Field>
      ) : null}
    </Screen>
  );
}
