export type Role = 'tourist' | 'provider' | 'vendor' | 'admin';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ProviderProfile {
  id: number;
  providerType: 'guide' | 'tour_operator' | 'vehicle_owner';
  businessName: string;
  licenceNo: string | null;
  description: string | null;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  avgRating: number;
  reviewCount: number;
}

export interface VendorProfile {
  id: number;
  shopName: string;
  description: string | null;
  address: string | null;
  district: string | null;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  avgRating: number;
  reviewCount: number;
}

export interface User {
  id: number;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
  preferredCurrency: string;
  preferredLanguage: string;
  isEmailVerified: boolean;
  createdAt: string;
  providerProfile: ProviderProfile | null;
  vendorProfile: VendorProfile | null;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface Destination {
  id: number;
  name: string;
  category: string;
  province: string;
  district: string;
  latitude: number;
  longitude: number;
  description: string | null;
  imageUrl: string | null;
  entryFee: number;
  avgRating: number;
  reviewCount: number;
  isActive: boolean;
}

export interface TripStop {
  id: number;
  stopOrder: number;
  legDistanceKm: number;
  legDurationMin: number;
  destinationId: number;
  destination: Destination;
}

export interface Trip {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
  startLat: number | null;
  startLng: number | null;
  startLabel: string | null;
  totalDistanceKm: number;
  totalDurationMin: number;
  estimatedCost: number;
  distanceSource: 'google' | 'ors' | 'osrm' | 'valhalla' | 'estimate';
  avoidHighways: boolean;
  routeGeometry: [number, number][] | null;
  stops: TripStop[];
  updatedAt: string;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface TourPackage {
  id: number;
  title: string;
  description: string;
  durationDays: number;
  pricePerPerson: number;
  maxGroupSize: number;
  inclusions: string[];
  exclusions: string[];
  imageUrl: string | null;
  cancellationPolicy: string | null;
  isActive: boolean;
  avgRating: number;
  reviewCount: number;
  provider: { id: number; businessName: string; providerType: string; avgRating: number; reviewCount: number };
  destinations: { dayNo: number; destinationId: number; destination: Pick<Destination, 'id' | 'name' | 'district' | 'latitude' | 'longitude'> }[];
}

export interface Vehicle {
  id: number;
  vehicleType: string;
  makeModel: string;
  seats: number;
  withDriver: boolean;
  pricePerDay: number;
  pricePerKm: number;
  driverFeePerDay: number;
  baseLocation: string;
  imageUrl: string | null;
  isActive: boolean;
  avgRating: number;
  reviewCount: number;
  provider: { id: number; businessName: string; avgRating: number; reviewCount: number };
  quote?: { lines: QuoteLine[]; total: number; days: number } | null;
}

export type BookingStatus = 'pending' | 'accepted' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export interface Payment {
  id: number;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  amount: number;
  paidAt: string | null;
  gatewayRef?: string;
  method?: string | null;
  createdAt?: string;
}

export interface Booking {
  id: number;
  bookingType: 'package' | 'vehicle';
  startDate: string;
  endDate: string;
  numPersons: number;
  estimatedKm: number;
  priceBreakdown: QuoteLine[];
  totalAmount: number;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
  package: { id: number; title: string; imageUrl: string | null; durationDays: number; provider: { id: number; userId: number; businessName: string } } | null;
  vehicle: { id: number; makeModel: string; vehicleType: string; imageUrl: string | null; withDriver: boolean; baseLocation: string; provider: { id: number; userId: number; businessName: string } } | null;
  tourist: { id: number; fullName: string; email: string; phone: string | null };
  payments: Payment[];
  review: { id: number; rating: number } | null;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  _count?: { products: number };
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stockQty: number;
  imageUrls: string[];
  isActive: boolean;
  avgRating: number;
  reviewCount: number;
  categoryId: number;
  category: { id: number; name: string };
  vendor: { id: number; shopName: string; district: string | null; avgRating: number; reviewCount: number };
}

export type ItemStatus = 'pending' | 'packed' | 'dispatched' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: number;
  productId: number;
  vendorId: number;
  quantity: number;
  unitPrice: number;
  itemStatus: ItemStatus;
  product: { id: number; name: string; imageUrls: string[] };
  vendor: { id: number; shopName: string };
  review: { id: number } | null;
}

export interface Order {
  id: number;
  totalAmount: number;
  deliveryType: 'hotel' | 'pickup';
  hotelName: string | null;
  deliveryAddress: string | null;
  status: 'pending_payment' | 'processing' | 'delivered' | 'cancelled';
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
}

export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  status: 'visible' | 'hidden' | 'reported';
  reportReason: string | null;
  providerReply: string | null;
  targetType: 'package' | 'vehicle' | 'product' | 'destination';
  targetId: number;
  createdAt: string;
  tourist?: { fullName: string; email?: string };
  verified?: boolean;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface Complaint {
  id: number;
  targetType: string;
  targetId: number | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  resolutionNote: string | null;
  createdAt: string;
  tourist?: { fullName: string; email: string };
  resolvedBy?: { fullName: string } | null;
}
