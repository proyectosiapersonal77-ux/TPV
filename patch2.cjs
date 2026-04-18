const fs = require('fs');
const file = './services/inventoryService.ts';
let code = fs.readFileSync(file, 'utf8');

const functionsToPatch = [
    'receivePurchase', 'bulkDeleteProducts', 'bulkUpdateProductCategory', 'processInventoryImport',
    'checkAndGeneratePurchaseOrder', 'registerWaste', 'deductProductStock', 'savePromotion'
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
