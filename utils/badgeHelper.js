const BADGE_LEVELS = [
    { threshold: 100, name: "Kind Starter", icon: "seed-outline", category: "Milestone", color: "#4ADE80" },
    { threshold: 250, name: "Bronze Donor", icon: "shield-outline", category: "Milestone", color: "#CD7F32" },
    { threshold: 500, name: "Silver Giver", icon: "shield-checkmark", category: "Milestone", color: "#C0C0C0" },
    { threshold: 750, name: "Gold Provider", icon: "trophy-outline", category: "Milestone", color: "#FFD700" },
    { threshold: 1000, name: "Platinum Helper", icon: "trophy", category: "Milestone", color: "#E5E4E2" },
    { threshold: 1500, name: "Community Star", icon: "star-outline", category: "Honor", color: "#60A5FA" },
    { threshold: 2000, name: "Guardian Angel", icon: "heart-circle", category: "Honor", color: "#F87171" },
    { threshold: 3000, name: "Kindness Hero", icon: "flash-outline", category: "Honor", color: "#A78BFA" },
    { threshold: 4000, name: "Life Changer", icon: "leaf-outline", category: "Ambassador", color: "#34D399" },
    { threshold: 5000, name: "Philanthropist", icon: "ribbon-outline", category: "Ambassador", color: "#FB923C" },
    { threshold: 6000, name: "Legendary Caretaker", icon: "diamond-outline", category: "Ambassador", color: "#38BDF8" },
    { threshold: 7500, name: "Global Giving King", icon: "planet-outline", category: "Legend", color: "#818CF8" },
    { threshold: 10000, name: "Ultimate Humanitarian", icon: "infinite-outline", category: "Legend", color: "#F472B6" },
    { threshold: 12000, name: "Unity Ambassador", icon: "people-circle", category: "Elite", color: "#6366F1" },
    { threshold: 14000, name: "Peace Keeper", icon: "sunny", category: "Elite", color: "#F59E0B" },
    { threshold: 16000, name: "Earth Guardian", icon: "earth", category: "Elite", color: "#10B981" },
    { threshold: 18000, name: "Heart of Gold", icon: "heart-half", category: "Elite", color: "#FBBF24" },
    { threshold: 20000, name: "Compassion Prince", icon: "medal", category: "Elite", color: "#8B5CF6" },
    { threshold: 22000, name: "Spark of Hope", icon: "sparkles", category: "Elite", color: "#38BDF8" },
    { threshold: 24000, name: "Bridge Builder", icon: "git-branch", category: "Elite", color: "#EC4899" },
    { threshold: 26000, name: "Visionary Giver", icon: "eye", category: "Elite", color: "#06B6D4" },
    { threshold: 28000, name: "Light Bringer", icon: "flashlight", category: "Elite", color: "#FCD34D" },
    { threshold: 30000, name: "Mountain Shaker", icon: "bonfire", category: "Elite", color: "#EF4444" },
    { threshold: 32000, name: "Ocean of Mercy", icon: "water", category: "Elite", color: "#3B82F6" },
    { threshold: 34000, name: "Galaxy Hero", icon: "rocket", category: "Elite", color: "#8B5CF6" },
    { threshold: 36000, name: "Dignity Defender", icon: "shield-half", category: "Elite", color: "#64748B" },
    { threshold: 38000, name: "Legacy Builder", icon: "business", category: "Elite", color: "#475569" },
    { threshold: 40000, name: "Soul Healer", icon: "fitness", category: "Elite", color: "#F43F5E" },
    { threshold: 42000, name: "Wisdom Speaker", icon: "mic-circle", category: "Elite", color: "#0EA5E9" },
    { threshold: 44000, name: "Truth Bearer", icon: "bulb", category: "Elite", color: "#EAB308" },
    { threshold: 46000, name: "Infinite Grace", icon: "infinite", category: "Master", color: "#A855F7" },
    { threshold: 48000, name: "Titan of Kindness", icon: "podium", category: "Master", color: "#6366F1" },
    { threshold: 50000, name: "Universal Impact", icon: "telescope", category: "Master", color: "#EC4899" },
    { threshold: 52000, name: "Stellar Protector", icon: "star-half", category: "Master", color: "#F59E0B" },
    { threshold: 54000, name: "Eternal Giver", icon: "hourglass", category: "Master", color: "#64748B" },
    { threshold: 56000, name: "Divine Helper", icon: "color-filter", category: "Master", color: "#D946EF" },
    { threshold: 58000, name: "Prism of Hope", icon: "prism", category: "Grandmaster", color: "#8B5CF6" },
    { threshold: 60000, name: "Shield of Saints", icon: "shield-star", category: "Grandmaster", color: "#10B981" },
    { threshold: 65000, name: "Crown of Mercy", icon: "ribbon", category: "Grandmaster", color: "#FACC15" },
    { threshold: 70000, name: "Flame of Charity", icon: "flame", category: "Grandmaster", color: "#F97316" },
    { threshold: 75000, name: "Anchor of Souls", icon: "anchor", category: "Legendary", color: "#0EA5E9" },
    { threshold: 80000, name: "World Changer", icon: "globe", category: "Legendary", color: "#84CC16" },
    { threshold: 85000, name: "Sovereign Giver", icon: "diamond", category: "Legendary", color: "#06B6D4" },
    { threshold: 90000, name: "Eclipse of Greed", icon: "moon", category: "Legendary", color: "#475569" },
    { threshold: 95000, name: "Aura of Peace", icon: "color-palette", category: "Mythical", color: "#F472B6" },
    { threshold: 100000, name: "The Zenith Giver", icon: "flash", category: "Mythical", color: "#EAB308" },
    { threshold: 110000, name: "Cosmic Architect", icon: "construct", category: "Mythical", color: "#6366F1" },
    { threshold: 120000, name: "Reality Shaper", icon: "cube", category: "Mythical", color: "#10B981" },
    { threshold: 130000, name: "Soul Architect", icon: "color-wand", category: "Divine", color: "#A855F7" },
    { threshold: 150000, name: "The Alpha Humanitarian", icon: "trophy", category: "Divine", color: "#EF4444" },
];

const checkAndAwardBadges = async (user) => {
    let updated = false;
    const currentPoints = user.points || 0;
    const currentBadgeNames = user.badges.map(b => b.name);
    const pendingBadgeNames = (user.pendingBadges || []).map(b => b.name);

    for (const badge of BADGE_LEVELS) {
        if (currentPoints >= badge.threshold && !currentBadgeNames.includes(badge.name) && !pendingBadgeNames.includes(badge.name)) {
            if (!user.pendingBadges) user.pendingBadges = [];
            user.pendingBadges.push({
                name: badge.name,
                icon: badge.icon,
                category: badge.category,
                threshold: badge.threshold,
                color: badge.color
            });
            updated = true;
        }
    }

    if (updated) {
        await user.save();
    }

    return updated;
};

module.exports = { BADGE_LEVELS, checkAndAwardBadges };
