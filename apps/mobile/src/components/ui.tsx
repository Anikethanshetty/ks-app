import { forwardRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** A paper-backed screen that lifts its content above the keyboard. */
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 justify-center px-gutter">{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string };

/** A labelled text input in the counter style. */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, className, ...props },
  ref,
) {
  return (
    <View className="gap-2">
      <Text className="font-anek-medium text-caption text-ink-soft">{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor="#6A6E67"
        className={`rounded-button border border-ruled bg-paper px-4 py-3.5 font-anek text-body-lg text-ink ${className ?? ""}`}
        {...props}
      />
      {error ? <Text className="font-anek text-caption text-chilli">{error}</Text> : null}
    </View>
  );
});

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, loading, disabled }: PrimaryButtonProps) {
  const inert = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      className={`h-14 items-center justify-center rounded-button bg-enamel ${inert ? "opacity-50" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color="#FBFAF6" />
      ) : (
        <Text className="font-anek-semibold text-body-lg text-paper">{label}</Text>
      )}
    </Pressable>
  );
}

/** A quiet, text-only action (e.g. "Change number", "Resend code"). */
export function LinkButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} className={disabled ? "opacity-40" : ""}>
      <Text className="text-center font-anek-medium text-body text-enamel">{label}</Text>
    </Pressable>
  );
}
