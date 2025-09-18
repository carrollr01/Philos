// Sophisticated matching algorithm for Philos
// Implements 100-point scoring system with semantic categories and vibe detection

// Semantic categories for related interests
const SEMANTIC_CATEGORIES = {
  lateNight: {
    keywords: ["3am", "midnight", "late night", "24-hour", "after hours", "night owl", "insomnia", "late night walks", "night drives"],
    related: ["coffee", "cafe", "nightlife", "bars", "clubs"]
  },
  coffee: {
    keywords: ["coffee", "espresso", "cafe", "latte", "coffee shop", "cappuccino", "americano", "cold brew", "coffee beans"],
    related: ["bookstores", "reading", "writing", "morning", "breakfast"]
  },
  fitness: {
    keywords: ["gym", "running", "hiking", "yoga", "crossfit", "cycling", "swimming", "weightlifting", "cardio", "workout", "exercise", "trail running", "marathon"],
    related: ["healthy eating", "nutrition", "outdoors", "nature"]
  },
  creative: {
    keywords: ["painting", "writing", "music", "art", "crafting", "creating", "drawing", "photography", "design", "poetry", "sculpting", "pottery", "knitting"],
    related: ["museums", "galleries", "concerts", "theater", "books"]
  },
  social: {
    keywords: ["parties", "game nights", "hosting", "gatherings", "friends", "socializing", "meetups", "events", "dinner parties", "board games"],
    related: ["cooking", "entertaining", "community", "networking"]
  },
  organized: {
    keywords: ["spreadsheets", "planning", "calendars", "meal prep", "organizing", "scheduling", "productivity", "systems", "routines", "checklists"],
    related: ["efficiency", "time management", "goals", "structure"]
  },
  vintage: {
    keywords: ["vintage", "thrift", "antique", "old", "retro", "classic", "vinyl", "records", "thrift stores", "flea markets", "collecting"],
    related: ["history", "nostalgia", "unique finds", "handmade"]
  },
  learning: {
    keywords: ["documentaries", "wikipedia", "reading", "podcasts", "courses", "learning", "education", "research", "books", "knowledge"],
    related: ["libraries", "museums", "lectures", "tutorials", "self-improvement"]
  },
  nature: {
    keywords: ["hiking", "camping", "outdoors", "mountains", "forests", "trails", "nature", "wildlife", "gardening", "beach", "lakes", "rivers"],
    related: ["photography", "conservation", "environment", "peace", "meditation"]
  }
};

// Vibe detection patterns
const VIBE_PATTERNS = {
  nightOwl: {
    keywords: ["3am", "midnight", "late night", "night owl", "insomnia", "night drives", "late night walks", "after hours"],
    threshold: 2
  },
  organized: {
    keywords: ["spreadsheets", "planning", "calendars", "meal prep", "organizing", "scheduling", "productivity", "systems", "routines", "checklists"],
    threshold: 2
  },
  creative: {
    keywords: ["painting", "writing", "music", "art", "crafting", "creating", "drawing", "photography", "design", "poetry", "sculpting", "pottery"],
    threshold: 2
  },
  social: {
    keywords: ["parties", "game nights", "hosting", "gatherings", "friends", "socializing", "meetups", "events", "dinner parties", "board games"],
    threshold: 2
  },
  adventurous: {
    keywords: ["hiking", "camping", "travel", "exploring", "adventure", "mountains", "trails", "new experiences", "backpacking", "road trips"],
    threshold: 2
  }
};

// Calculate match score between two users' favorites
export function calculateMatchScore(user1Favorites, user2Favorites) {
  let totalScore = 0;
  const exactMatches = [];
  const relatedMatches = [];
  
  // Check for exact matches first (20 points each)
  for (let i = 0; i < user1Favorites.length; i++) {
    const fav1 = user1Favorites[i].toLowerCase().trim();
    for (let j = 0; j < user2Favorites.length; j++) {
      const fav2 = user2Favorites[j].toLowerCase().trim();
      
      if (fav1 === fav2 && fav1 !== '') {
        totalScore += 20;
        exactMatches.push({
          item: user1Favorites[i],
          index1: i,
          index2: j
        });
      }
    }
  }
  
  // Check for related matches (15 points for very related, 10 for somewhat related)
  for (let i = 0; i < user1Favorites.length; i++) {
    const fav1 = user1Favorites[i].toLowerCase().trim();
    if (fav1 === '') continue;
    
    for (let j = 0; j < user2Favorites.length; j++) {
      const fav2 = user2Favorites[j].toLowerCase().trim();
      if (fav2 === '') continue;
      
      // Skip if already exact match
      if (fav1 === fav2) continue;
      
      const relationScore = getRelationScore(fav1, fav2);
      if (relationScore > 0) {
        totalScore += relationScore;
        relatedMatches.push({
          item1: user1Favorites[i],
          item2: user2Favorites[j],
          score: relationScore,
          index1: i,
          index2: j
        });
      }
    }
  }
  
  // Check for vibe match (15 points)
  const user1Vibe = detectVibe(user1Favorites);
  const user2Vibe = detectVibe(user2Favorites);
  
  if (user1Vibe && user2Vibe && user1Vibe === user2Vibe) {
    totalScore += 15;
  }
  
  return {
    totalScore: Math.min(totalScore, 100), // Cap at 100
    exactMatches,
    relatedMatches,
    vibeMatch: user1Vibe && user2Vibe && user1Vibe === user2Vibe,
    user1Vibe,
    user2Vibe
  };
}

// Get relation score between two favorites
function getRelationScore(fav1, fav2) {
  // Check if they're in the same semantic category
  for (const [categoryName, category] of Object.entries(SEMANTIC_CATEGORIES)) {
    const fav1InCategory = category.keywords.some(keyword => 
      fav1.includes(keyword) || keyword.includes(fav1)
    );
    const fav2InCategory = category.keywords.some(keyword => 
      fav2.includes(keyword) || keyword.includes(fav2)
    );
    
    if (fav1InCategory && fav2InCategory) {
      return 15; // Very related - same category
    }
    
    // Check if one is in category and other is related
    const fav1Related = category.related.some(keyword => 
      fav1.includes(keyword) || keyword.includes(fav1)
    );
    const fav2Related = category.related.some(keyword => 
      fav2.includes(keyword) || keyword.includes(fav2)
    );
    
    if ((fav1InCategory && fav2Related) || (fav2InCategory && fav1Related)) {
      return 10; // Somewhat related
    }
  }
  
  // Check for partial word matches (somewhat related)
  const words1 = fav1.split(/\s+/);
  const words2 = fav2.split(/\s+/);
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.length > 3 && word2.length > 3) {
        if (word1.includes(word2) || word2.includes(word1)) {
          return 10; // Somewhat related
        }
      }
    }
  }
  
  return 0;
}

// Detect user's vibe based on their favorites
function detectVibe(favorites) {
  const vibeCounts = {};
  
  for (const [vibeName, pattern] of Object.entries(VIBE_PATTERNS)) {
    let count = 0;
    for (const favorite of favorites) {
      const favLower = favorite.toLowerCase();
      for (const keyword of pattern.keywords) {
        if (favLower.includes(keyword)) {
          count++;
          break; // Count each favorite only once per vibe
        }
      }
    }
    
    if (count >= pattern.threshold) {
      vibeCounts[vibeName] = count;
    }
  }
  
  // Return the most prominent vibe
  const sortedVibes = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1]);
  return sortedVibes.length > 0 ? sortedVibes[0][0] : null;
}

// Get match designation based on score
export function getMatchDesignation(score, exactMatches) {
  if (exactMatches.length > 0) {
    return {
      type: 'exact',
      emoji: '⚡',
      label: 'EXACT MATCH',
      description: `You both love '${exactMatches[0].item}'!`,
      color: '#FFD700' // Gold
    };
  }
  
  if (score >= 85) {
    return {
      type: 'incredible',
      emoji: '🔥',
      label: 'INCREDIBLE MATCH',
      description: 'You two are meant to be friends!',
      color: '#FF6B35' // Orange-red
    };
  }
  
  if (score >= 65) {
    return {
      type: 'great',
      emoji: '✨',
      label: 'GREAT MATCH',
      description: 'You have a lot in common!',
      color: '#7FB5A6' // Seafoam green
    };
  }
  
  if (score <= 15) {
    return {
      type: 'opposites',
      emoji: '🧲',
      label: 'OPPOSITES ATTRACT',
      description: 'Sometimes the best friendships are unexpected!',
      color: '#9B8B7A' // Taupe
    };
  }
  
  return null; // No special designation for 16-64 points
}

// Sort users by match quality
export function sortUsersByMatch(users, currentUserFavorites) {
  return users.map(user => {
    const matchData = calculateMatchScore(currentUserFavorites, user.favorites || []);
    const designation = getMatchDesignation(matchData.totalScore, matchData.exactMatches);
    
    return {
      ...user,
      matchData,
      designation,
      sortPriority: getSortPriority(matchData, designation)
    };
  }).sort((a, b) => {
    // First by sort priority, then by score
    if (a.sortPriority !== b.sortPriority) {
      return b.sortPriority - a.sortPriority;
    }
    return b.matchData.totalScore - a.matchData.totalScore;
  });
}

// Get sort priority for ordering
function getSortPriority(matchData, designation) {
  if (designation?.type === 'exact') return 1000; // Exact matches first
  if (matchData.totalScore >= 65) return 800; // Great/Incredible matches
  if (matchData.totalScore >= 40) return 600; // Good matches
  if (designation?.type === 'opposites') return 200; // Opposites attract mixed in
  return 400; // Regular matches
}

// Format match details for display
export function formatMatchDetails(matchData) {
  const details = [];
  
  if (matchData.exactMatches.length > 0) {
    details.push({
      type: 'exact',
      text: `⚡ You both love "${matchData.exactMatches[0].item}"`,
      items: matchData.exactMatches.map(match => match.item)
    });
  }
  
  if (matchData.relatedMatches.length > 0) {
    const topRelated = matchData.relatedMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    
    topRelated.forEach(match => {
      details.push({
        type: 'related',
        text: `${match.item1} ↔ ${match.item2}`,
        score: match.score
      });
    });
  }
  
  if (matchData.vibeMatch) {
    details.push({
      type: 'vibe',
      text: `You're both ${matchData.user1Vibe.replace(/([A-Z])/g, ' $1').toLowerCase()}!`,
      vibe: matchData.user1Vibe
    });
  }
  
  return details;
}