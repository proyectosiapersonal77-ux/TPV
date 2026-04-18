const fs = require('fs');
const file = './components/config/InventoryManagement.tsx';
let code = fs.readFileSync(file, 'utf8');

// Ensure import
if (!code.includes("import { applyTourRestrictionNoThrow } from '../../utils/tourMode';")) {
    code = code.replace("import BarcodeLib from 'react-barcode';", "import BarcodeLib from 'react-barcode';\nimport { applyTourRestrictionNoThrow } from '../../utils/tourMode';");
}

const mutators = [
    "const handleSave = async (e: React.FormEvent) => {\\n    e.preventDefault();",
    "const handleSaveEdit = async () => {\\n      if (!editingCell) return;",
    "const handleRegisterWaste = async (e: React.FormEvent) => {\\n      e.preventDefault();",
    "const confirmDelete = async () => {",
    "const executeMassUpdate = async () => {",
    "const handleBulkDelete = async () => {"
];

for (const m of mutators) {
    const unescaped = m.replace(/\\n/g, '\n');
    let replacement = unescaped;
    if (m.includes('{')) {
        replacement = unescaped + "\n      if (applyTourRestrictionNoThrow()) return;";
    }
    
    if (code.includes(unescaped) && !code.includes(unescaped + "\n      if (applyTourRestrictionNoThrow()) return;")) {
       code = code.replace(unescaped, replacement);
    }
}

// Check other inline submits
code = code.replace(/onSubmit=\{\(e\) => \{\n\s*e\.preventDefault\(\);\n\s*setSaving\(true\);\n\s*try \{\n\s*await InventoryService\.savePromotion/g, 
    "onSubmit={(e) => {\n                            e.preventDefault();\n                            if (applyTourRestrictionNoThrow()) return;\n                            setSaving(true);\n                            try {\n                                await InventoryService.savePromotion");

code = code.replace(/onSubmit=\{\(e\) => \{\n\s*e\.preventDefault\(\);\n\s*setSaving\(true\);\n\s*try \{\n\s*await InventoryService\.savePurchaseOrder/g, 
    "onSubmit={(e) => {\n                            e.preventDefault();\n                            if (applyTourRestrictionNoThrow()) return;\n                            setSaving(true);\n                            try {\n                                await InventoryService.savePurchaseOrder");

fs.writeFileSync(file, code);
