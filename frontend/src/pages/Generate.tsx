import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Select, TextInput, TextArea, Icon, Skeleton, ErrorState } from '../components/ui';
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

function GroupedOptions<T extends { id: string }>({
  parts,
  labelFor,
}: {
  parts: Partitioned<T>;
  labelFor: (item: T) => string;
}) {
  const opt = (item: T) => (
    <option key={item.id} value={item.id}>
      {labelFor(item)}
    </option>
  );
  const grouped = parts.recommended.length > 0 || parts.works.length > 0;
  if (!grouped) return <>{parts.rest.map(opt)}</>;
  return (
    <>
      {parts.recommended.length > 0 && (
        <optgroup label="Recommended">{parts.recommended.map(opt)}</optgroup>
      )}
      {parts.works.length > 0 && <optgroup label="Works well">{parts.works.map(opt)}</optgroup>}
      {parts.rest.length > 0 && <optgroup label="Other">{parts.rest.map(opt)}</optgroup>}
    </>
  );
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

  const angleParts = useMemo(
    () =>
      partitionByRecommendation(config?.angles ?? [], config?.personaAngleMap[form.persona]),
    [config, form.persona],
  );
  const hookParts = useMemo(
    () => partitionByRecommendation(config?.hooks ?? [], config?.angleHookMap[form.angle]),
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
      navigate(`/progress/${encodeURIComponent(ad_id)}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not start generation. Please try again.');
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
          value={form.persona}
          error={errors.persona}
          onChange={(e) => set('persona', e.target.value)}
        >
          <option value="" disabled>
            Select a persona
          </option>
          {config.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <div className={styles.row}>
          <Select
            label="Journey type"
            value={form.journey_type}
            onChange={(e) => set('journey_type', e.target.value as JourneyType)}
          >
            <option value="pre_trip">Pre-trip</option>
            <option value="in_trip">In-trip</option>
          </Select>
          <Select
            label="Brand"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value as Brand)}
          >
            <option value="headout">Headout</option>
            <option value="non_headout">Non-Headout</option>
          </Select>
        </div>

        <Select
          label="Angle"
          required
          value={form.angle}
          error={errors.angle}
          hint={form.persona ? 'Sorted for the selected persona.' : undefined}
          onChange={(e) => set('angle', e.target.value)}
        >
          <option value="" disabled>
            Select an angle
          </option>
          <GroupedOptions parts={angleParts} labelFor={(a) => `${a.id} · ${a.name}`} />
        </Select>

        <Select
          label="Hook"
          required
          value={form.hook}
          error={errors.hook}
          hint={form.angle ? 'Sorted for the selected angle.' : undefined}
          onChange={(e) => set('hook', e.target.value)}
        >
          <option value="" disabled>
            Select a hook
          </option>
          <GroupedOptions parts={hookParts} labelFor={(h) => h.name} />
        </Select>

        <Select
          label="Video format"
          value={form.video_format}
          onChange={(e) => set('video_format', e.target.value as VideoFormat)}
        >
          <option value="9:16">9:16 — vertical</option>
          <option value="1:1">1:1 — square</option>
          <option value="16:9">16:9 — landscape</option>
          <option value="all">All formats</option>
        </Select>

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
