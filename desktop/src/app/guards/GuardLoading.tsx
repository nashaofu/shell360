import { Spinner } from "@radix-ui/themes";
import AuthLayout from "@/app/layouts/AuthLayout";

export default function GuardLoading() {
  return (
    <AuthLayout>
      <div
        style={{
          minHeight: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size="3" />
      </div>
    </AuthLayout>
  );
}
