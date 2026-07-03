"use client";

import { useEffect, useState } from "react";
import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";

export default function DatePickerInput({
  id,
  value,
  onChange,
  className = "modal-input tracker-date-input",
  placeholder = "Seleccionar fecha",
  enableTime = false,
  minDate,
  maxDate,
}) {
  const [inputElement, setInputElement] = useState(null);

  useEffect(() => {
    if (!inputElement) {
      return undefined;
    }

    const instance = flatpickr(inputElement, {
      allowInput: true,
      altFormat: enableTime ? "d-m-Y, H:i" : "d-m-Y",
      altInput: true,
      dateFormat: enableTime ? "Y-m-d\\TH:i" : "Y-m-d",
      disableMobile: true,
      enableTime,
      locale: Spanish,
      maxDate,
      minDate,
      monthSelectorType: "dropdown",
      time_24hr: true,
      onChange: (selectedDates, dateStr) => {
        onChange(dateStr);
      },
    });

    return () => instance.destroy();
  }, [enableTime, inputElement, maxDate, minDate, onChange]);

  useEffect(() => {
    if (inputElement?._flatpickr && inputElement._flatpickr.input.value !== value) {
      inputElement._flatpickr.setDate(value || "", false);
    }
  }, [inputElement, value]);

  return (
    <input
      id={id}
      ref={setInputElement}
      type="text"
      className={className}
      placeholder={placeholder}
      defaultValue={value || ""}
    />
  );
}
