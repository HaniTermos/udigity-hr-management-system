import { DeliveryFrame } from '@/components/delivery/DeliveryFrame';
import { DealDetailView } from '@/components/delivery/DealDetailView';

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DeliveryFrame>
      <DealDetailView id={id} />
    </DeliveryFrame>
  );
}
