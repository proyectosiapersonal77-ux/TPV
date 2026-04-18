const fs = require('fs');
const file = './services/inventoryService.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import { applyTourRestriction }")) {
    code = code.replace("import { logAction } from './auditService';", "import { logAction } from './auditService';\nimport { applyTourRestriction } from '../utils/tourMode';");
}

const functionsToPatch = [
    'createProduct', 'updateProduct', 'deleteProduct', 'updateStock', 'createStockMovement',
    'createWasteReason', 'updateWasteReason', 'deleteWasteReason', 'createCourse', 'updateCourse',
    'deleteCourse', 'createCategory', 'updateCategory', 'deleteCategory', 'createSubcategory',
    'updateSubcategory', 'deleteSubcategory', 'createSupplier', 'updateSupplier', 'deleteSupplier',
    'createAllergen', 'updateAllergen', 'deleteAllergen', 'createUnit', 'updateUnit', 'deleteUnit',
    'savePurchaseOrder', 'updatePurchaseOrderStatus', 'deletePurchaseOrder', 'createPromotion',
    'updatePromotion', 'deletePromotion'
];

for (const fn of functionsToPatch) {
    const regex = new RegExp(`export const ${fn} = async \\([^\\)]*\\)(:[^=]+)? => \\{\\n`, 'g');
    if(!code.includes(`export const ${fn} =`)) {
        console.log("NOT FOUND: " + fn);
    }
    code = code.replace(regex, (match) => {
        if (!match.includes('applyTourRestriction')) {
             return match + "  applyTourRestriction();\n";
        }
        return match;
    });
}
fs.writeFileSync(file, code);
