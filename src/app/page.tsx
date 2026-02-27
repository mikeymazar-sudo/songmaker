"use client";

import { useState, useEffect } from "react";
import { Mic2, Music, Save, Settings2, Sparkles, Play, Code2, Trash2, Wand2, Loader2, Download, Volume2, FastForward, ChevronDown, ImageIcon } from "lucide-react";

interface ArtistProfile {
  id: string;
  name: string;
  soundDescription: string;
}

export default function Home() {
  const [profiles, setProfiles] = useState<ArtistProfile[]>([]);
  const [currentProfileName, setCurrentProfileName] = useState("");
  const [currentProfileSound, setCurrentProfileSound] = useState("");

  // Form State
  const [genre, setGenre] = useState("Cinematic Pop");
  const [mood, setMood] = useState("Uplifting and somewhat dramatic");
  const [idea, setIdea] = useState("A song about space exploration that builds up to an epic drop");
  const [duration, setDuration] = useState(120);
  const [instrumental, setInstrumental] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [genreOpen, setGenreOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Cover Art State
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("elevenlabs_artist_profiles");
    if (saved) {
      try {
        setProfiles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse profiles", e);
      }
    }
  }, []);

  // Save to LocalStorage
  const saveProfiles = (newProfiles: ArtistProfile[]) => {
    setProfiles(newProfiles);
    localStorage.setItem("elevenlabs_artist_profiles", JSON.stringify(newProfiles));
  };

  const handleSaveCurrent = () => {
    if (!currentProfileName.trim() || !currentProfileSound.trim()) {
      alert("Please enter both a name and a sound description for your Artist Profile.");
      return;
    }

    const newProfile: ArtistProfile = {
      id: crypto.randomUUID(),
      name: currentProfileName,
      soundDescription: currentProfileSound
    };

    saveProfiles([...profiles, newProfile]);
    setCurrentProfileName("");
    setCurrentProfileSound("");
  };

  const loadProfile = (profile: ArtistProfile) => {
    setIdea((prev) => prev.trim() ? prev + ` [Vocal/Sound Style: ${profile.soundDescription}]` : `[Vocal/Sound Style: ${profile.soundDescription}]`);
  };

  const deleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveProfiles(profiles.filter(p => p.id !== id));
  };

  const handleEnhancePrompt = async () => {
    setIsEnhancing(true);
    try {
      const response = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, genre, mood }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to enhance prompt");
      }

      setIdea(data.improvedIdea);

      // Optional: you could show data.feedback in a toast/alert
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Compile prompt according to ElevenLabs best practices
  const compiledPrompt = instrumental
    ? `${genre}, ${mood}. Instrumental only, no vocals.`
    : `${genre}, ${mood}.`;

  const elevenLabsPayload = {
    prompt: compiledPrompt,
    text: idea, // Structural tags passed to text parameter
    music_length_ms: duration * 1000,
    force_instrumental: instrumental
  };

  // Generate Audio from ElevenLabs
  const handleGenerateMusic = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setAudioUrl(null);

    // Simulate progress bar while waiting for the long API call
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        // cap simulated progress at 90% until it actually finishes
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 5) + 1;
      });
    }, 1000);

    try {
      const response = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(elevenLabsPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setGenerationProgress(100);
      setTimeout(() => {
        setAudioUrl(url);
      }, 500); // short delay to show 100% full bar

    } catch (error: any) {
      alert(error.message);
      setGenerationProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
    }
  };

  // Generate Cover Art from Gemini
  const handleGenerateCover = async () => {
    setIsGeneratingCover(true);
    setCoverImageUrl(null);

    try {
      const response = await fetch("/api/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate cover art");
      }

      const data = await response.json();
      if (data.imageBase64) {
        setCoverImageUrl(`data:image/jpeg;base64,${data.imageBase64}`);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  return (
    <div className="min-h-screen p-8 lg:p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-accent/20 rounded-xl border border-accent/30 shadow-[0_0_15px_rgba(107,33,168,0.5)]">
            <Music className="w-8 h-8 text-accent-hover" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
              ElevenLabs Music Studio
            </h1>
            <p className="text-foreground/60 text-sm mt-1">Design the perfect prompt and manage your Artist Profiles</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface/50 backdrop-blur-xl border border-border p-6 rounded-2xl shadow-xl relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-accent-hover" />
                Song Configuration
              </h2>
              <button
                onClick={handleEnhancePrompt}
                disabled={isEnhancing}
                className="bg-accent/20 hover:bg-accent/40 text-accent-hover px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 border border-accent/20"
              >
                {isEnhancing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Auto-Improve Prompt
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2 relative">
                <label className="text-sm text-foreground/80 font-medium">Genre & Style</label>
                <div className="relative">
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    onFocus={() => setGenreOpen(true)}
                    onBlur={() => setTimeout(() => setGenreOpen(false), 200)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all pr-10"
                    placeholder="e.g., Synthwave, Acoustic Pop..."
                  />
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-foreground/50 pointer-events-none" />
                </div>
                {genreOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 w-full bg-surface border border-border rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                    {["Cinematic Pop", "Acoustic Folk", "Cyberpunk Synthwave", "Lo-Fi Chillhop", "Epic Orchestral", "Heavy Metal", "R&B Soul", "Electronic Dance (EDM)"].map(opt => (
                      <div key={opt} onClick={() => setGenre(opt)} className="px-4 py-2 hover:bg-accent/20 cursor-pointer text-sm font-medium">{opt}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 relative">
                <label className="text-sm text-foreground/80 font-medium">Mood</label>
                <div className="relative">
                  <input
                    type="text"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    onFocus={() => setMoodOpen(true)}
                    onBlur={() => setTimeout(() => setMoodOpen(false), 200)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all pr-10"
                    placeholder="e.g., Uplifting, Melancholic..."
                  />
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-foreground/50 pointer-events-none" />
                </div>
                {moodOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 w-full bg-surface border border-border rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                    {["Uplifting and somewhat dramatic", "Melancholic and reflective", "High-energy and aggressive", "Dark and suspenseful", "Dreamy and ethereal", "Happy and bouncy"].map(opt => (
                      <div key={opt} onClick={() => setMood(opt)} className="px-4 py-2 hover:bg-accent/20 cursor-pointer text-sm font-medium">{opt}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between items-center bg-background/50 border border-border px-4 py-3 rounded-lg">
                <div>
                  <label className="text-foreground font-medium block">Instrumental Only</label>
                  <span className="text-xs text-foreground/50">Generate music without vocals</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={instrumental}
                    onChange={(e) => setInstrumental(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-hover"></div>
                </label>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-sm text-foreground/80 font-medium flex justify-between">
                <span>Duration (Seconds)</span>
                <span className="text-accent-hover font-mono">{duration}s</span>
              </label>
              <input
                type="range"
                min="3"
                max="300"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-accent-hover h-2 bg-border rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-foreground/40 font-mono">
                <span>3s</span>
                <span>300s (5m)</span>
              </div>
            </div>

            {!instrumental && (
              <div className="space-y-2">
                <label className="text-sm text-foreground/80 font-medium flex items-center justify-between">
                  Song Idea / Lyrics
                  <span className="text-xs text-foreground/40 select-none">Describe your song, AI will write the lyrics!</span>
                </label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  rows={8}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono text-sm resize-none"
                  placeholder="e.g. A song about discovering a magical sword in a cybernetic forest..."
                />
              </div>
            )}
          </div>

          {/* Prompt Output Preview */}
          <div className="bg-gradient-to-br from-surface to-background border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-accent-hover" />
              API Payload Preview
            </h2>
            <p className="text-sm text-foreground/60 mb-4">
              Here is the exact payload you will send to the ElevenLabs Music API based on their guidelines.
            </p>
            <div className="bg-black/50 p-4 rounded-xl border border-white/5 font-mono text-sm text-purple-200/80 overflow-x-auto">
              <pre>{JSON.stringify(elevenLabsPayload, null, 2)}</pre>
            </div>
            <button
              onClick={handleGenerateMusic}
              disabled={isGenerating}
              className="w-full mt-4 bg-accent hover:bg-accent-hover text-white py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(107,33,168,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] flex items-center justify-center gap-2 group-hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 disabled:shadow-none relative overflow-hidden"
            >
              {isGenerating ? (
                <>
                  <div className="absolute inset-0 bg-white/20" style={{ width: `${generationProgress}%`, transition: 'width 0.5s ease' }}></div>
                  <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                  <span className="relative z-10">Synthesizing Audio... {generationProgress}%</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Copy Payload & Generate
                </>
              )}
            </button>

            {/* Audio Player Result */}
            {audioUrl && (
              <div className="mt-6 bg-background/80 p-4 rounded-xl border border-accent/30 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-2 text-accent-hover font-medium">
                  <Volume2 className="w-5 h-5" />
                  <h3>Generation Complete</h3>
                </div>

                <audio controls className="w-full rounded-lg" src={audioUrl}>
                  Your browser does not support the audio element.
                </audio>

                <a
                  href={audioUrl}
                  download={`elevenlabs-${genre.replace(/\s+/g, '-').toLowerCase()}.mp3`}
                  className="w-full bg-white text-black hover:bg-gray-200 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Audio File
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Cover Art & Artist Profiles */}
        <div className="space-y-6">

          {/* Cover Art Generator */}
          <div className="bg-surface/50 backdrop-blur-xl border border-border p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-accent-hover" />
              Cover Art
            </h2>
            <p className="text-sm text-foreground/60 mb-6">
              Generate stunning album artwork based on your Song Idea using Google's Gemini Vision API.
            </p>

            <button
              onClick={handleGenerateCover}
              disabled={isGeneratingCover}
              className="w-full mb-6 bg-accent/20 hover:bg-accent/40 text-accent-hover py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-accent/20"
            >
              {isGeneratingCover ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Painting Cover Art...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Cover Art
                </>
              )}
            </button>

            {coverImageUrl && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="relative group rounded-xl overflow-hidden border border-accent/30 shadow-lg">
                  <img src={coverImageUrl} alt="Generated Cover Art" className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a
                      href={coverImageUrl}
                      download={`cover-art-${genre.replace(/\s+/g, '-').toLowerCase()}.jpg`}
                      className="bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Save Image
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Artist Profiles */}
          <div className="bg-surface/50 backdrop-blur-xl border border-border p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-accent-hover" />
              Artist Profiles
            </h2>
            <p className="text-sm text-foreground/60 mb-6">
              Save your current configuration as an Artist Profile to quickly recall this sound later.
            </p>

            <div className="flex flex-col gap-3 mb-8">
              <input
                type="text"
                value={currentProfileName}
                onChange={(e) => setCurrentProfileName(e.target.value)}
                placeholder="Artist Name (e.g. DJ Deep Space)"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentProfileSound}
                  onChange={(e) => setCurrentProfileSound(e.target.value)}
                  placeholder="Sound (e.g. Raspy male vocals with heavy reverb)"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrent()}
                />
                <button
                  onClick={handleSaveCurrent}
                  className="bg-white text-black px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-foreground/40 uppercase tracking-wider mb-2">Saved Profiles</h3>

              {profiles.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-xl">
                  <Sparkles className="w-6 h-6 text-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-foreground/40">No profiles saved yet.</p>
                </div>
              ) : (
                profiles.map(profile => (
                  <div
                    key={profile.id}
                    onClick={() => loadProfile(profile)}
                    className="group bg-background border border-border hover:border-accent hover:bg-accent/5 p-3 rounded-xl cursor-pointer transition-all relative overflow-hidden flex items-start justify-between"
                  >
                    <div>
                      <h4 className="font-medium text-foreground group-hover:text-accent-hover transition-colors">
                        {profile.name}
                      </h4>
                      <p className="text-xs text-foreground/50 mt-1 line-clamp-1">
                        {profile.soundDescription}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteProfile(profile.id, e)}
                      className="p-2 text-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
