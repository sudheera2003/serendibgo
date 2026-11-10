import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapIcon, ShieldCheckIcon, ShoppingBagIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

const PILLARS = [
  { icon: MapIcon, title: 'Plan smarter trips', text: 'Multi-stop routes with real distances, travel times and costs.' },
  { icon: ShieldCheckIcon, title: 'Book with trust', text: 'Verified guides and rentals, reviewed only by real customers.' },
  { icon: ShoppingBagIcon, title: 'Shop local', text: 'Authentic spices, tea and crafts delivered to your hotel.' },
];

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View className="w-full max-w-xl flex-1 justify-between self-center px-6 pb-6 pt-10">
        <View className="gap-3">
          <Text className="text-5xl font-extrabold text-primary-foreground">SerendibGO</Text>
          <Text className="text-lg text-primary-foreground/80">Your companion for exploring Sri Lanka – and supporting the people who make it special.</Text>
        </View>
        <View className="gap-4">
          {PILLARS.map((p) => (
            <View key={p.title} className="flex-row items-start gap-3 rounded-2xl bg-white/10 p-4">
              <View className="rounded-full bg-white/15 p-2">
                <Icon as={p.icon} size={20} className="text-primary-foreground" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-primary-foreground">{p.title}</Text>
                <Text className="text-sm text-primary-foreground/75">{p.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <View className="gap-3">
          <Button size="lg" className="bg-white active:bg-white/90" onPress={() => router.push('/register')}>
            <Text className="text-base font-semibold text-teal-800">Create an account</Text>
          </Button>
          <Button size="lg" variant="ghost" className="border border-white/40" onPress={() => router.push('/login')}>
            <Text className="text-base font-semibold text-primary-foreground">I already have an account</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
