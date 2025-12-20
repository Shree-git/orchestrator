import { useState, useCallback } from 'react';
import type { FeatureSuggestion } from '@/lib/electron';

export function useSuggestionsState() {
  const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [featureSuggestions, setFeatureSuggestions] = useState<
    FeatureSuggestion[]
  >([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const updateSuggestions = useCallback((suggestions: FeatureSuggestion[]) => {
    setFeatureSuggestions(suggestions);
    setSuggestionsCount(suggestions.length);
  }, []);

  const closeSuggestionsDialog = useCallback(() => {
    setShowSuggestionsDialog(false);
  }, []);

  return {
    // State
    showSuggestionsDialog,
    suggestionsCount,
    featureSuggestions,
    isGeneratingSuggestions,
    // Setters
    setShowSuggestionsDialog,
    setSuggestionsCount,
    setFeatureSuggestions,
    setIsGeneratingSuggestions,
    // Helpers
    updateSuggestions,
    closeSuggestionsDialog,
  };
}
