import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Angle, AngleHookMap, Hook, Persona, PersonaAngleMap } from '../lib/types';

export interface GenerateConfig {
  angles: Angle[];
  hooks: Hook[];
  personas: Persona[];
  angleHookMap: AngleHookMap;
  personaAngleMap: PersonaAngleMap;
}

interface State {
  config: GenerateConfig | null;
  loading: boolean;
  error: string | null;
}

/** Loads every dropdown source (and the two recommendation maps) in parallel. */
export function useGenerateConfig() {
  const [state, setState] = useState<State>({ config: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState({ config: null, loading: true, error: null });
    try {
      const [angles, hooks, personas, angleHookMap, personaAngleMap] = await Promise.all([
        api.getAngles(),
        api.getHooks(),
        api.getPersonas(),
        api.getAngleHookMap(),
        api.getPersonaAngleMap(),
      ]);
      setState({
        config: { angles, hooks, personas, angleHookMap, personaAngleMap },
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({ config: null, loading: false, error: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
