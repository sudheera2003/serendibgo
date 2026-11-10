import * as React from 'react';
import { View } from 'react-native';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Ask for a short text (e.g. a rejection reason). */
  input?: { placeholder: string; required?: boolean };
}

type Resolver = (v: { ok: boolean; text?: string }) => void;

const ConfirmContext = React.createContext<(o: ConfirmOptions) => Promise<{ ok: boolean; text?: string }>>(async () => ({ ok: false }));

/** Promise-based confirmation dialog: `const { ok } = await confirm({...})`. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const [text, setText] = React.useState('');
  const resolver = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((o: ConfirmOptions) => {
    setText('');
    setOpts(o);
    return new Promise<{ ok: boolean; text?: string }>((resolve) => (resolver.current = resolve));
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.({ ok, text: text.trim() || undefined });
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description ? <AlertDialogDescription>{opts.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {opts?.input ? (
            <View>
              <Input value={text} onChangeText={setText} placeholder={opts.input.placeholder} autoFocus />
            </View>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => close(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!opts?.input?.required && text.trim().length < 3}
              className={opts?.destructive ? 'bg-destructive' : undefined}
              onPress={() => close(true)}>
              <Text>{opts?.confirmLabel ?? 'Confirm'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => React.useContext(ConfirmContext);
