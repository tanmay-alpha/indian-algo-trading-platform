// Local ambient declarations for `react-hook-form`. The package is not
// installed because the `<Form />` shadcn component is not used by any page.
// These minimal stubs let `src/components/ui/form.tsx` type-check.
declare module "react-hook-form" {
  export type ControllerProps<TFieldValues extends Record<string, unknown> = Record<string, unknown>, TName extends string = string> = {
    name: TName;
    control: unknown;
    rules?: unknown;
    defaultValue?: unknown;
    disabled?: boolean;
    shouldUnregister?: boolean;
    children?: React.ReactNode;
    render?: (props: {
      field: {
        name: string;
        value: unknown;
        onChange: (...args: unknown[]) => void;
        onBlur: () => void;
        ref: React.Ref<unknown>;
      };
      fieldState: {
        invalid: boolean;
        isTouched: boolean;
        isDirty: boolean;
        error?: unknown;
      };
      formState: unknown;
    }) => React.ReactNode;
  };

  export type FieldPath<TFieldValues extends Record<string, unknown>> = string;
  export type FieldValues = Record<string, unknown>;

  export const Controller: <T extends Record<string, unknown> = Record<string, unknown>>(
    props: ControllerProps<T>,
  ) => React.ReactElement | null;

  export const FormProvider: (props: { children: React.ReactNode }) => React.ReactElement;
  export const useFormContext: () => {
    getFieldState: (
      name: string,
      formState?: unknown,
    ) => {
      invalid: boolean;
      isTouched: boolean;
      isDirty: boolean;
      error?: { message?: string } | undefined;
    };
    formState: unknown;
  };
}
