import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'react-hot-toast';
import { Code, Check, Loader2, ChevronLeft } from 'lucide-react';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface ParsedItem {
  category_name: string;
  name: string;
  description: string;
  price: number;
  food_types: string[];
  selected: boolean;
}

export function JsonBulkUploadPage() {
  const navigate = useNavigate();
  
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'success'>('input');
  const [importSummary, setImportSummary] = useState({ categories: 0, items: 0 });

  const processJson = () => {
    try {
      const data = JSON.parse(jsonInput);
      if (!Array.isArray(data)) {
        toast.error('JSON must be an array of items');
        return;
      }
      
      const items = data.map((item: any) => ({
        category_name: item.category_name || item.category || 'Uncategorized',
        name: item.name || 'Unknown Item',
        description: item.description || '',
        price: parseFloat(item.price) || 0,
        food_types: Array.isArray(item.food_types) ? item.food_types : ['veg'],
        selected: true
      }));
      
      setParsedItems(items);
      setStep('preview');
      toast.success(`Parsed ${items.length} items successfully`);
    } catch (error) {
      toast.error('Invalid JSON format');
    }
  };

  const handleItemChange = (index: number, field: keyof ParsedItem, value: any) => {
    const newItems = [...parsedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setParsedItems(newItems);
  };

  const importItems = async () => {
    const selectedItems = parsedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to import');
      return;
    }
    
    setIsImporting(true);
    try {
      const res = await api.post('/bulk-upload/confirm', { items: selectedItems });
      setImportSummary({
        categories: res.data.categories_created,
        items: res.data.items_created
      });
      setStep('success');
      toast.success('Menu imported successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to import items');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/menu-items')}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            JSON Bulk Upload <Code size={20} className="text-blue-500" />
          </h2>
          <p className="text-slate-500">Paste your JSON data to bulk import menu items.</p>
        </div>
      </div>

      {step === 'input' && (
        <Card className="bg-slate-50/50 dark:bg-slate-900/20">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-4">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Paste JSON Array
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="[\n  {\n    &quot;category&quot;: &quot;Fried Chicken&quot;,\n    &quot;name&quot;: &quot;Fried Chicken Popcorn&quot;,\n    &quot;price&quot;: 90,\n    &quot;food_types&quot;: [&quot;non-veg&quot;]\n  }\n]"
                className="w-full h-96 p-4 font-mono text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
              />
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => setJsonInput('')}>
                  Clear
                </Button>
                <Button onClick={processJson} disabled={!jsonInput.trim()}>
                  Parse JSON
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-10">
            <div>
              <p className="text-sm text-slate-500">Parsed {parsedItems.length} items from JSON</p>
              <p className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <button onClick={() => setStep('input')} className="text-xs text-primary hover:underline">Edit JSON</button>
              </p>
            </div>
            <Button onClick={importItems} disabled={isImporting}>
              {isImporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Check size={16} className="mr-2" />}
              Import {parsedItems.filter(i => i.selected).length} Items
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">
                      <input 
                        type="checkbox" 
                        checked={parsedItems.every(i => i.selected)}
                        onChange={(e) => setParsedItems(parsedItems.map(i => ({...i, selected: e.target.checked})))}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="px-4 py-3 min-w-[150px]">Category</th>
                    <th className="px-4 py-3 min-w-[200px]">Item Name</th>
                    <th className="px-4 py-3 min-w-[250px]">Description</th>
                    <th className="px-4 py-3 w-28">Price (₹)</th>
                    <th className="px-4 py-3 w-32">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedItems.map((item, idx) => (
                    <tr key={idx} className={!item.selected ? "opacity-50 bg-slate-50 dark:bg-slate-900/50" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"}>
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={item.selected}
                          onChange={(e) => handleItemChange(idx, 'selected', e.target.checked)}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          value={item.category_name}
                          onChange={(e) => handleItemChange(idx, 'category_name', e.target.value)}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary rounded px-2 py-1 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="w-full bg-transparent font-medium border border-transparent hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary rounded px-2 py-1 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          value={item.description || ''}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Optional"
                          className="w-full bg-transparent text-slate-500 border border-transparent hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary rounded px-2 py-1 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number"
                          value={item.price}
                          onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary rounded px-2 py-1 transition-colors"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.food_types[0] || 'veg'}
                          onChange={(e) => handleItemChange(idx, 'food_types', [e.target.value])}
                          className="w-full bg-transparent text-sm border border-transparent hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary rounded px-1 py-1 transition-colors"
                        >
                          <option value="veg">Veg</option>
                          <option value="non-veg">Non-Veg</option>
                          <option value="egg">Egg</option>
                          <option value="drink">Drink</option>
                          <option value="none">None</option>
                          <option value="dessert">Dessert</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <Card className="border-green-200 dark:border-green-900/30 overflow-hidden bg-green-50/30 dark:bg-green-900/10">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <Check size={40} className="animate-[scale-in_0.5s_ease-out]" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Import Successful!</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm">
              Your menu has been updated with {importSummary.items} new items across {importSummary.categories} categories.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => navigate('/menu-items')}>
                View Menu Items
              </Button>
              <Button variant="outline" onClick={() => {
                setJsonInput('');
                setParsedItems([]);
                setStep('input');
              }}>
                Upload Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
