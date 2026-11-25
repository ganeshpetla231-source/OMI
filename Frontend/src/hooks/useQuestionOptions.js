import { useCallback, useEffect, useRef, useState } from 'react';
import { questionsApi } from '../services/api/questionsApi';

const loaders = {
  categories: () => questionsApi.getCategories(),
  roles: (category) => questionsApi.getRoles({ category }),
  skills: (category, jobRole) => questionsApi.getSkills({ category, jobRole }),
};

function initialState() {
  return Object.fromEntries(Object.keys(loaders).map((key) => [
    key,
    { items: [], loading: true, error: null, offline: false },
  ]));
}

export function useQuestionOptions(category = '', jobRole = '') {
  const [resources, setResources] = useState(initialState);
  const requestIds = useRef({ categories: 0, roles: 0, skills: 0 });
  const active = useRef(true);

  const load = useCallback(async (key, ...args) => {
    const requestId = ++requestIds.current[key];
    setResources((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: null },
    }));
    try {
      const result = await loaders[key](...args);
      if (active.current && requestIds.current[key] === requestId) {
        setResources((current) => ({
          ...current,
          [key]: { items: result.items, loading: false, error: null, offline: result.offline, query: args },
        }));
      }
    } catch (error) {
      if (active.current && requestIds.current[key] === requestId) {
        setResources((current) => ({
          ...current,
          [key]: { ...current[key], loading: false, error, query: args },
        }));
      }
    }
  }, []);

  useEffect(() => {
    active.current = true;
    void load('categories');
    return () => { active.current = false; };
  }, [load]);

  useEffect(() => {
    active.current = true;
    void load('roles', category);
    return () => { active.current = false; };
  }, [category, load]);

  useEffect(() => {
    active.current = true;
    void load('skills', category, jobRole);
    return () => { active.current = false; };
  }, [category, jobRole, load]);

  return {
    ...resources,
    retry: (key) => load(key, key === 'roles' ? category : key === 'skills' ? category : undefined, ...(key === 'skills' ? [jobRole] : [])),
  };
}
