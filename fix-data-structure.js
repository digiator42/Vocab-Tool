// Data Structure Fix Utility
// Run this in the browser console to diagnose and fix corrupted localStorage data

console.log('=== Checking customGermanLists structure ===');
const customLists = JSON.parse(localStorage.getItem('customGermanLists')) || {};

console.log('Number of lists:', Object.keys(customLists).length);
console.log('List names:', Object.keys(customLists));

// Check each list
Object.entries(customLists).forEach(([listName, listCards]) => {
    console.log(`\nList: "${listName}"`);
    console.log('  Type:', typeof listCards);
    console.log('  Is Array:', Array.isArray(listCards));

    if (!Array.isArray(listCards)) {
        console.error(`  ❌ ERROR: "${listName}" is not an array!`);
        console.log('  Value:', listCards);

        // Try to fix it
        if (listCards && typeof listCards === 'object') {
            // Check if it's an object with numeric keys (array-like)
            const keys = Object.keys(listCards);
            const isArrayLike = keys.every(key => !isNaN(parseInt(key)));

            if (isArrayLike) {
                console.log(`  🔧 Attempting to convert to array...`);
                const fixedArray = Object.values(listCards);
                customLists[listName] = fixedArray;
                console.log(`  ✅ Converted to array with ${fixedArray.length} items`);
            }
        }
    } else {
        console.log(`  ✅ OK: Array with ${listCards.length} items`);
    }
});

// Save the fixed data
console.log('\n=== Saving fixed data ===');
localStorage.setItem('customGermanLists', JSON.stringify(customLists));
console.log('✅ Data saved! Please reload the page.');
