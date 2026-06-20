import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Select,
  TextInput,
  TextArea,
  Icon,
  Skeleton,
  ErrorState,
  type SelectOption,
} from '../components/ui';
import { useGenerateConfig } from '../hooks/useGenerateConfig';
import { partitionByRecommendation, type Partitioned } from '../lib/recommend';
import { api, ApiError } from '../lib/api';
import type { Brand, GenerateInput, JourneyType, VideoFormat } from '../lib/types';
import styles from './Generate.module.css';

type FormState = {
  experience_id: string;
  persona: string;
  journey_type: JourneyType;
  brand: Brand;
  angle: string;
  hook: string;
  video_format: VideoFormat;
  additional_details: string;
};

const INITIAL: FormState = {
  experience_id: '',
  persona: '',
  journey_type: 'pre_trip',
  brand: 'headout',
  angle: '',
  hook: '',
  video_format: '9:16',
  additional_details: '',
};

const REQUIRED: (keyof FormState)[] = ['experience_id', 'persona', 'angle', 'hook'];

const JOURNEY_OPTIONS: SelectOption[] = [
  { value: 'pre_trip', label: 'Pre-trip' },
  { value: 'in_trip', label: 'In-trip' },
];
const BRAND_OPTIONS: SelectOption[] = [
  { value: 'headout', label: 'Headout' },
  { value: 'non_headout', label: 'Non-Headout' },
];
const FORMAT_OPTIONS: SelectOption[] = [
  { value: '9:16', label: '9:16 — vertical' },
  { value: '1:1', label: '1:1 — square' },
  { value: '16:9', label: '16:9 — landscape' },
  { value: 'all', label: 'All formats' },
];

/** Flatten a recommendation partition into grouped Select options. */
function toOptions<T extends { id: string }>(
  parts: Partitioned<T>,
  labelFor: (item: T) => string,
): SelectOption[] {
  const grouped = parts.recommended.length > 0 || parts.works.length > 0;
  if (!grouped) return parts.rest.map((t) => ({ value: t.id, label: labelFor(t) }));
  return [
    ...parts.recommended.map((t) => ({ value: t.id, label: labelFor(t), group: 'Recommended' })),
    ...parts.works.map((t) => ({ value: t.id, label: labelFor(t), group: 'Works well' })),
    ...parts.rest.map((t) => ({ value: t.id, label: labelFor(t), group: 'Other' })),
  ];
}

export function Generate() {
  const { config, loading, error, reload } = useGenerateConfig();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const personaOptions = useMemo<SelectOption[]>(
    () => (config?.personas ?? []).map((p) => ({ value: p.id, label: p.name })),
    [config],
  );
  const angleOptions = useMemo<SelectOption[]>(
    () =>
      toOptions(
        partitionByRecommendation(config?.angles ?? [], config?.personaAngleMap[form.persona]),
        (a) => `${a.id} · ${a.name}`,
      ),
    [config, form.persona],
  );
  const hookOptions = useMemo<SelectOption[]>(
    () =>
      toOptions(
        partitionByRecommendation(config?.hooks ?? [], config?.angleHookMap[form.angle]),
        (h) => h.name,
      ),
    [config, form.angle],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    for (const key of REQUIRED) {
      if (!form[key].trim()) nextErrors[key] = 'Required';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: GenerateInput = {
      experience_id: form.experience_id.trim(),
      persona: form.persona,
      journey_type: form.journey_type,
      brand: form.brand,
      angle: form.angle,
      hook: form.hook,
      video_format: form.video_format,
      additional_details: form.additional_details.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const { ad_id } = await api.generate(payload);
      navigate(`/progress/${encodeURIComponent(ad_id)}`, { state: { payload } });
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not start generation. Please try again.',
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <h1 className="t-display-sm">Create a new ad</h1>
        <div className={styles.loading} style={{ marginTop: 'var(--space-32)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={56} radius={12} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className={styles.page}>
        <ErrorState
          title="Couldn’t load the form"
          message={error ?? 'Configuration is unavailable.'}
          action={<Button onClick={reload}>Try again</Button>}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={`${styles.header} t-display-sm`}>Create a new ad</h1>
      <p className={`${styles.subtitle} t-para-lg`}>
        Turn a Headout experience into a UGC-style video ad.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Experience ID"
          required
          inputMode="numeric"
          placeholder="e.g. 7148"
          hint="Headout tour group ID — try 7148 (Colosseum) or 23604 (Eiffel Tower)."
          value={form.experience_id}
          error={errors.experience_id}
          onChange={(e) => set('experience_id', e.target.value)}
        />

        <Select
          label="Persona"
          required
          placeholder="Select a persona"
          options={personaOptions}
          value={form.persona}
          error={errors.persona}
          onChange={(v) => set('persona', v)}
        />

        <div className={styles.row}>
          <Select
            label="Journey type"
            options={JOURNEY_OPTIONS}
            value={form.journey_type}
            onChange={(v) => set('journey_type', v as JourneyType)}
          />
          <Select
            label="Brand"
            options={BRAND_OPTIONS}
            value={form.brand}
            onChange={(v) => set('brand', v as Brand)}
          />
        </div>

        <Select
          label="Angle"
          required
          placeholder="Select an angle"
          options={angleOptions}
          value={form.angle}
          error={errors.angle}
          hint={form.persona ? 'Sorted for the selected persona.' : undefined}
          onChange={(v) => set('angle', v)}
        />

        <Select
          label="Hook"
          required
          placeholder="Select a hook"
          options={hookOptions}
          value={form.hook}
          error={errors.hook}
          hint={form.angle ? 'Sorted for the selected angle.' : undefined}
          onChange={(v) => set('hook', v)}
        />

        <Select
          label="Video format"
          options={FORMAT_OPTIONS}
          value={form.video_format}
          onChange={(v) => set('video_format', v as VideoFormat)}
        />

        <TextArea
          label="Additional details"
          placeholder="Anything the script should emphasize (optional)"
          maxLength={500}
          value={form.additional_details}
          onChange={(e) => set('additional_details', e.target.value)}
        />

        {submitError && (
          <div className={`${styles.banner} t-para-md`} role="alert">
            <Icon name="alert" size={20} />
            <span>{submitError}</span>
          </div>
        )}

        <div className={styles.actions}>
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Generate ad
          </Button>
        </div>
      </form>
    </div>
  );
}
