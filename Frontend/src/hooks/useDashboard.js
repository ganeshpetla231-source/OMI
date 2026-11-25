import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardApi } from '../services/api/dashboardApi';

const RESOURCES = {
  stats: dashboardApi.getStats,
  activity: dashboardApi.getActivity,
  skills: dashboardApi.getSkills,
  recommendations: dashboardApi.getRecommendations,
};

function initialResourceState() {
  return Object.fromEntries(Object.keys(RESOURCES).map((key) => [key, { data: null, loading: true, error: null }]));
}

export function useDashboard() {
  const [resources, setResources] = useState(initialResourceState);
  const activeRef = useRef(true);
  const requestIdsRef = useRef(Object.fromEntries(Object.keys(RESOURCES).map((key) => [key, 0])));

  const loadResource = useCallback(async (key) => {
    const requestId = ++requestIdsRef.current[key];
    setResources((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: null },
    }));
    try {
      const data = await RESOURCES[key]();
      if (activeRef.current && requestIdsRef.current[key] === requestId) {
        setResources((current) => ({ ...current, [key]: { data, loading: false, error: null } }));
      }
    } catch (error) {
      if (activeRef.current && requestIdsRef.current[key] === requestId) {
        setResources((current) => ({ ...current, [key]: { data: null, loading: false, error } }));
      }
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    Object.keys(RESOURCES).forEach((key) => { void loadResource(key); });
    return () => {
      activeRef.current = false;
    };
  }, [loadResource]);

  const retry = useCallback((key) => loadResource(key), [loadResource]);
  return { ...resources, retry };
}
