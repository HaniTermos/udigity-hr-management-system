import { DeliveryFrame } from '@/components/delivery/DeliveryFrame';
import { ProjectBoard } from '@/components/delivery/ProjectBoard';

export default async function ProjectBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DeliveryFrame>
      <ProjectBoard id={id} />
    </DeliveryFrame>
  );
}
