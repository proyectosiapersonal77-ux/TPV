const fs = require('fs');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace .toFixed(2)}€ with .toFixed(2).replace('.', ',')}€
    content = content.replace(/\.toFixed\(2\)}€/g, ".toFixed(2).replace('.', ',')}€");
    content = content.replace(/\.toFixed\(3\)}€/g, ".toFixed(3).replace('.', ',')}€");
    
    // Also replace .toFixed(2) + '€' if any
    content = content.replace(/\.toFixed\(2\) \+ '€'/g, ".toFixed(2).replace('.', ',') + '€'");
    
    // For recharts formatters: `${value.toFixed(2)}€` -> `${value.toFixed(2).replace('.', ',')}€`
    content = content.replace(/\$\{value\.toFixed\(2\)}€/g, "${value.toFixed(2).replace('.', ',')}€");

    // Also replace '0.00'}€
    content = content.replace(/'0\.00'}€/g, "'0,00'}€");
    
    fs.writeFileSync(filePath, content);
}

replaceInFile('./components/Analytics/AnalyticsScreen.tsx');
replaceInFile('./components/config/InventoryManagement.tsx');
console.log('Done');
