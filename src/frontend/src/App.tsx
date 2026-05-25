import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { SetupGuide } from './components/SetupGuide';
import { MapView } from './components/MapView';
import { ListingsPanel } from './components/ListingsPanel';
import { ChatPanel } from './components/ChatPanel';
import { useBackendStatus } from './hooks/useBackendStatus';
import { useDemoData } from './hooks/useDemoData';
import { SearchResult } from './types';
import './App.css';

// Helper to get the API base URL, supporting Codespaces
const getApiBaseUrl = (): string => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Auto-detect Codespaces URL from current hostname
  const hostname = window.location.hostname;
  if (hostname.includes('.app.github.dev') || hostname.includes('.preview.app.github.dev')) {
    // Replace port 3000 with 8000 in the Codespaces URL
    return window.location.origin.replace('-3000.', '-8000.');
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

const App: React.FC = () => {
  const { isConnected, isChecking, refetch } = useBackendStatus();
  const { searchListings, getSearchResults, isLoading: isDemoLoading } = useDemoData();
  
  const [showSetupGuide, setShowSetupGuide] = useState(true);
  const [listings, setListings] = useState<SearchResult[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<number | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation] = useState({ lat: 39.7392, lng: -104.9903 }); // Denver

  const isDemo = !isConnected;

  // Only show listings from search results - don't fetch all listings on initial load
  useEffect(() => {
    if (!isConnected && !isDemoLoading) {
      // Show demo listings only in demo mode
      const demoListings = getSearchResults(5);
      setListings(demoListings);
    } else if (isConnected) {
      // When connected, start with empty listings - user will search via chat
      setListings([]);
    }
  }, [isConnected, isDemoLoading, getSearchResults]);

  // Backend search function
  const handleBackendSearch = useCallback(async (query: string): Promise<{ message: string; listings: SearchResult[]; agentPath?: string[] }> => {
    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE_URL}/query_message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      
      // Backend returns search_results, not listings
      const searchResults: SearchResult[] = (data.search_results || data.listings || []).map((result: any) => {
        const listing = result.listing || result;
        return {
          id: listing._id ?? listing.id ?? Math.floor(Math.random() * 1000000),
          name: listing.name,
          price: typeof listing.price === 'number' ? listing.price : parseFloat(listing.price?.replace(/[$,]/g, '') || '0'),
          lat: listing.location?.coordinates?.[1] ?? listing.latitude,
          lng: listing.location?.coordinates?.[0] ?? listing.longitude,
          property_type: listing.property_type,
          bedrooms: listing.bedrooms,
          similarity_score: result.score || listing.similarity_score,
          description: listing.description,
        };
      });

      setListings(searchResults);
      return { message: data.message, listings: searchResults, agentPath: data.agent_path || [] };
    } catch (error) {
      console.error('Backend search error:', error);
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Demo search function
  const handleDemoSearch = useCallback((query: string): { message: string; listings: SearchResult[] } => {
    const results = searchListings(query, 5);
    setListings(results);
    
    const demoMessages = [
      `I found ${results.length} listings that might match "${query}"! These results are from demo data - complete Module 2 to enable AI-powered responses.`,
      `Here are ${results.length} properties related to "${query}". Note: This is demo mode. The real AI will provide personalized recommendations!`,
      `Looking for "${query}"? I found ${results.length} options! Complete the workshop to unlock intelligent search and chat.`,
    ];
    
    return {
      message: demoMessages[Math.floor(Math.random() * demoMessages.length)],
      listings: results,
    };
  }, [searchListings]);

  const handleSelectListing = useCallback((listing: SearchResult) => {
    setSelectedListingId(listing.id);
  }, []);

  return (
    <div className="app">
      <Header
        isConnected={isConnected}
        isChecking={isChecking}
        isDemo={isDemo}
        onRetryConnection={refetch}
      />

      <main className="app-main">
        <div className="app-layout">
          {/* Map Section */}
          <section className="map-section">
            <MapView
              listings={listings}
              selectedId={selectedListingId}
              onSelectListing={handleSelectListing}
              center={userLocation}
            />
          </section>

          {/* Listings Section */}
          <section className="listings-section">
            <ListingsPanel
              listings={listings}
              selectedId={selectedListingId}
              onSelectListing={handleSelectListing}
              isLoading={isSearching}
              isDemo={isDemo}
            />
          </section>

          {/* Chat Section */}
          <section className="chat-section">
            <ChatPanel
              isBackendConnected={isConnected}
              isDemo={isDemo}
              onSearch={handleBackendSearch}
              onDemoSearch={handleDemoSearch}
            />
          </section>
        </div>
      </main>

      {/* Setup Guide Modal - shown when backend not connected */}
      <SetupGuide
        isVisible={showSetupGuide && isDemo && !isChecking}
        onDismiss={() => setShowSetupGuide(false)}
      />
    </div>
  );
};

export default App;