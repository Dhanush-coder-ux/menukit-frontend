import re

filepath = "d:/projects/menu_project/menu_frontend/src/pages/public/PublicMenuPage.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

old_block = """        // Fetch active discounts for the banner
        try {
          const discountRes = await api.get(`/public/shop/${id}/discounts`);
          setActiveDiscounts(discountRes.data || []);
        } catch {
          // Non-critical — silently ignore
        }"""

new_block = """        // Fetch active discounts for the banner
        try {
          const discountRes = await api.get(`/public/shop/${id}/discounts`);
          const now = new Date();
          const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
          const currentTime = now.getHours() * 60 + now.getMinutes();
          
          const filteredDiscounts = (discountRes.data || []).filter((d: Discount) => {
            if (d.available_days && d.available_days.length > 0) {
              if (!d.available_days.includes(currentDay)) return false;
            }
            if (d.available_time_presets && d.available_time_presets.length > 0) {
              const timingFilters = [];
              if (currentTime >= 240 && currentTime < 480) timingFilters.push('Early Morning');
              if (currentTime >= 480 && currentTime < 720) timingFilters.push('Morning');
              if (currentTime >= 720 && currentTime < 960) timingFilters.push('Afternoon');
              if (currentTime >= 960 && currentTime < 1200) timingFilters.push('Evening');
              if (currentTime >= 1200 && currentTime < 1440) timingFilters.push('Night');
              if (currentTime >= 0 && currentTime < 240) timingFilters.push('Mid-night');
              
              if (!timingFilters.some(t => d.available_time_presets?.includes(t))) return false;
            }
            return true;
          });
          
          setActiveDiscounts(filteredDiscounts);
        } catch {
          // Non-critical — silently ignore
        }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Could not find block")
