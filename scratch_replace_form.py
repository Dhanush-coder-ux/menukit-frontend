import re

filepath = "d:/projects/menu_project/menu_frontend/src/pages/discounts/DiscountsPage.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Extract the form content between `<form onSubmit={handleSubmit} className="mt-4 space-y-5">` and `</form>`
start_tag = '<form onSubmit={handleSubmit} className="mt-4 space-y-5">'
end_tag = '</form>'

start_idx = content.find(start_tag)
end_idx = content.find(end_tag, start_idx) + len(end_tag)

if start_idx == -1 or end_idx == -1:
    print("Could not find form block")
    exit(1)

new_form = """<form onSubmit={e => {
          e.preventDefault();
          if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
          }
        }} className="mt-2 flex flex-col min-h-[500px]">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 1 ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>1</div>
              <div className={`w-12 h-1 rounded-full ${currentStep > 1 ? 'bg-primary' : 'bg-slate-100'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 2 ? 'bg-primary text-white shadow-md' : currentStep > 2 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>2</div>
              <div className={`w-12 h-1 rounded-full ${currentStep > 2 ? 'bg-primary' : 'bg-slate-100'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === 3 ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>3</div>
            </div>
            <span className="text-sm font-medium text-slate-500">
              {currentStep === 1 ? 'Basics' : currentStep === 2 ? 'Details' : 'Availability'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-1 space-y-5 no-scrollbar pb-4">
            {/* Step 1: Basics */}
            {currentStep === 1 && (
              <>
                <Input
                  label="Offer Title *"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Weekend Special 20% Off"
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Description (shown on banner)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. Enjoy 20% off on all items this weekend only!"
                    className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-900 min-h-[80px] resize-y"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Offer Type *</label>
                  <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                    {(modalCategory === 'discount' ? ['percentage', 'flat'] : ['bogo', 'combo'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, discount_type: type as any, applies_to: (type === 'bogo' || type === 'combo') ? 'items' : formData.applies_to })}
                        className={`py-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-colors ${
                          formData.discount_type === type
                            ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {type === 'percentage' && <Percent size={14} />}
                        {type === 'flat' && <span className="font-semibold text-sm">{currencySymbol}</span>}
                        {type === 'bogo' && <Sparkles size={14} />}
                        {type === 'combo' && <Layers size={14} />}
                        
                        {type === 'percentage' && 'Percentage'}
                        {type === 'flat' && 'Flat Amount'}
                        {type === 'bogo' && 'BOGO'}
                        {type === 'combo' && 'Combo'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Details */}
            {currentStep === 2 && (
              <>
                {['percentage', 'flat'].includes(formData.discount_type) && (
                  <Input
                    label={formData.discount_type === 'percentage' ? 'Percentage (%) *' : `Amount (${currencySymbol}) *`}
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.discount_type === 'percentage' ? '100' : undefined}
                    value={formData.discount_value}
                    onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'percentage' ? '10' : '50'}
                    required={['percentage', 'flat'].includes(formData.discount_type)}
                  />
                )}

                {formData.discount_type === 'bogo' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
                    <Input
                      label="Buy Quantity *"
                      type="number"
                      min="1"
                      value={formData.buy_quantity}
                      onChange={e => setFormData({ ...formData, buy_quantity: e.target.value })}
                      placeholder="e.g. 2"
                      required={formData.discount_type === 'bogo'}
                    />
                    <Input
                      label="Get Quantity (Free) *"
                      type="number"
                      min="1"
                      value={formData.get_quantity}
                      onChange={e => setFormData({ ...formData, get_quantity: e.target.value })}
                      placeholder="e.g. 1"
                      required={formData.discount_type === 'bogo'}
                    />
                  </div>
                )}

                {formData.discount_type === 'combo' && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
                    <Input
                      label={`Combo Price (${currencySymbol}) *`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.discount_value}
                      onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                      placeholder="e.g. 499"
                      required={formData.discount_type === 'combo'}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {formData.discount_type === 'bogo' ? 'Buy these items (Required Purchase) *' : 'Applies To'}
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                    {([
                      { v: 'all', label: 'All Items', icon: <ShoppingBag size={13} /> },
                      { v: 'category', label: 'Categories', icon: <Layers size={13} /> },
                      { v: 'items', label: 'Items', icon: <Tag size={13} /> },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setFormData({ ...formData, applies_to: opt.v, target_ids: [] })}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          formData.applies_to === opt.v
                            ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>

                  {formData.applies_to === 'category' && (
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto">
                      {categories.length === 0 ? (
                        <p className="text-xs text-slate-500">No categories found</p>
                      ) : categories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleTargetId(cat.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            formData.target_ids.includes(cat.id)
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/50'
                          }`}
                        >
                          {formData.target_ids.includes(cat.id) && <X size={10} />}
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {formData.applies_to === 'items' && (
                    <div className="flex flex-col gap-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                      {menuItems.length === 0 ? (
                        <p className="text-xs text-slate-500">No items found</p>
                      ) : menuItems.map(item => (
                        <label
                          key={item.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                            formData.target_ids.includes(item.id) ? 'bg-primary/5' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.target_ids.includes(item.id)}
                            onChange={() => toggleTargetId(item.id)}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{item.name}</span>
                          <span className="ml-auto text-xs text-slate-400">{currencySymbol}{item.price}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {formData.discount_type === 'bogo' && (
                  <div className="space-y-3 pt-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Get these items (Reward) *</label>
                    <div className="flex flex-col gap-1 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 max-h-48 overflow-y-auto">
                      {menuItems.length === 0 ? (
                        <p className="text-xs text-slate-500">No items found</p>
                      ) : menuItems.map(item => (
                        <label
                          key={`reward-${item.id}`}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-800/30 transition-colors ${
                            formData.reward_target_ids.includes(item.id) ? 'bg-indigo-100 dark:bg-indigo-800/50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.reward_target_ids.includes(item.id)}
                            onChange={() => {
                              const newTargets = formData.reward_target_ids.includes(item.id)
                                ? formData.reward_target_ids.filter(id => id !== item.id)
                                : [...formData.reward_target_ids, item.id];
                              setFormData({ ...formData, reward_target_ids: newTargets });
                            }}
                            className="w-4 h-4 rounded accent-indigo-600"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{item.name}</span>
                          <span className="ml-auto text-xs text-slate-400">{currencySymbol}{item.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Crown size={16} className="text-purple-500" /> Members Only
                    </p>
                    <p className="text-xs text-slate-500">Only visible to registered and logged-in members</p>
                  </div>
                  <div
                    onClick={() => setFormData({ ...formData, members_only: !formData.members_only })}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.members_only ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${formData.members_only ? 'translate-x-6' : ''}`} />
                  </div>
                </label>
              </>
            )}

            {/* Step 3: Availability */}
            {currentStep === 3 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                      <Calendar size={14} className="text-primary" /> Start Date
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="date"
                        value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                        onChange={e => {
                          const d = e.target.value;
                          if (!d) setFormData({ ...formData, start_date: '' });
                          else {
                            const t = formData.start_date ? formData.start_date.split('T')[1] || '00:00' : '00:00';
                            setFormData({ ...formData, start_date: `${d}T${t}` });
                          }
                        }}
                        className="flex-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700"
                      />
                      <input
                        type="time"
                        value={formData.start_date ? formData.start_date.split('T')[1] || '' : ''}
                        onChange={e => {
                          const t = e.target.value;
                          if (!t) return;
                          const d = formData.start_date ? formData.start_date.split('T')[0] : new Date().toISOString().split('T')[0];
                          setFormData({ ...formData, start_date: `${d}T${t}` });
                        }}
                        disabled={!formData.start_date}
                        className="flex-1 sm:flex-none sm:w-32 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700 disabled:opacity-50 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                      <Clock size={14} className="text-amber-500" /> End Date
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="date"
                        value={formData.end_date ? formData.end_date.split('T')[0] : ''}
                        onChange={e => {
                          const d = e.target.value;
                          if (!d) setFormData({ ...formData, end_date: '' });
                          else {
                            const t = formData.end_date ? formData.end_date.split('T')[1] || '00:00' : '00:00';
                            setFormData({ ...formData, end_date: `${d}T${t}` });
                          }
                        }}
                        className="flex-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700"
                      />
                      <input
                        type="time"
                        value={formData.end_date ? formData.end_date.split('T')[1] || '' : ''}
                        onChange={e => {
                          const t = e.target.value;
                          if (!t) return;
                          const d = formData.end_date ? formData.end_date.split('T')[0] : new Date().toISOString().split('T')[0];
                          setFormData({ ...formData, end_date: `${d}T${t}` });
                        }}
                        disabled={!formData.end_date}
                        className="flex-1 sm:flex-none sm:w-32 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-700 disabled:opacity-50 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Available Days</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                      const isSelected = formData.available_days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormData({ ...formData, available_days: formData.available_days.filter(d => d !== day) });
                            } else {
                              setFormData({ ...formData, available_days: [...formData.available_days, day] });
                            }
                          }}
                          className={`w-11 h-11 rounded-xl text-xs font-medium transition-colors border flex items-center justify-center ${
                            isSelected 
                              ? 'bg-primary border-primary text-white shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Leave all unchecked if available every day.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Timing Presets</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'Early Morning', label: 'Early Morning (04:00 - 08:00)' },
                      { id: 'Morning', label: 'Morning (08:00 - 12:00)' },
                      { id: 'Afternoon', label: 'Afternoon (12:00 - 16:00)' },
                      { id: 'Evening', label: 'Evening (16:00 - 20:00)' },
                      { id: 'Night', label: 'Night (20:00 - 00:00)' },
                      { id: 'Mid-night', label: 'Mid-night (00:00 - 04:00)' }
                    ].map(preset => {
                      const isSelected = formData.available_time_presets.includes(preset.id);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormData({ ...formData, available_time_presets: formData.available_time_presets.filter(p => p !== preset.id) });
                            } else {
                              setFormData({ ...formData, available_time_presets: [...formData.available_time_presets, preset.id] });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                            isSelected 
                              ? 'bg-primary border-primary text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Leave all unchecked if available all day.</p>
                </div>

                <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Enable Offer</p>
                    <p className="text-xs text-slate-500">Publish this offer to the public menu now</p>
                  </div>
                  <div
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.is_active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${formData.is_active ? 'translate-x-6' : ''}`} />
                  </div>
                </label>
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
            <Button 
              variant="secondary" 
              type="button" 
              onClick={() => {
                if (currentStep > 1) setCurrentStep(currentStep - 1);
                else setIsModalOpen(false);
              }}
            >
              {currentStep > 1 ? 'Back' : 'Cancel'}
            </Button>
            
            {currentStep < 3 ? (
              <Button 
                type="submit"
              >
                Next Step
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} isLoading={isSubmitting}>
                {editingDiscount ? 'Update Offer' : 'Create Offer'}
              </Button>
            )}
          </div>
        </form>"""

new_content = content[:start_idx] + new_form + content[end_idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Replaced successfully")
