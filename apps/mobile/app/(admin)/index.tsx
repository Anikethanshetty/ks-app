import { Placeholder } from "@/components/Placeholder";
import { SignOutButton } from "@/components/SignOutButton";

export default function AdminHome() {
  return (
    <Placeholder
      title="ಆಡಳಿತ"
      subtitle="Order board + inventory (Phase 1)"
      footer={<SignOutButton />}
    />
  );
}
