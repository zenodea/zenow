"use client";

import { useState } from "react";

/**
 * Shows the stored key inside the box rather than describing it underneath,
 * and clears it the moment you type.
 *
 * The visible input is deliberately unnamed. If it carried the field name it
 * would submit the masked hint as though it were a new key, and saving without
 * touching the field would overwrite a real key with "sk-…3b38". The hidden
 * input is the one that submits, and it stays empty until you actually type --
 * blank means "keep what is stored".
 */
export function SecretField({
  name,
  hint,
  placeholder,
  multiline = false,
  className = "",
}: {
  name: string;
  hint: string | null;
  placeholder: string;
  multiline?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const shown = touched ? value : (hint ?? "");
  const shared = {
    value: shown,
    placeholder: hint ? "" : placeholder,
    autoComplete: "off" as const,
    spellCheck: false,
    onFocus: () => setTouched(true),
    onChange: (event: { target: { value: string } }) => {
      setTouched(true);
      setValue(event.target.value);
    },
    className: `${className} ${!touched && hint ? "text-muted" : ""}`,
  };

  return (
    <>
      {multiline ? <textarea rows={3} {...shared} /> : <input type="text" {...shared} />}
      <input type="hidden" name={name} value={touched ? value : ""} />
    </>
  );
}
