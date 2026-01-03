// utils/helpers.js - Helper functions
function parseQuotedArguments(fullArgs) {
  const args = [];
  let currentArg = '';
  let inQuotes = false;
  
  for (let i = 0; i < fullArgs.length; i++) {
    const char = fullArgs[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (currentArg) {
        args.push(currentArg);
        currentArg = '';
      }
    } else {
      currentArg += char;
    }
  }
  
  if (currentArg) {
    args.push(currentArg);
  }
  
  return args;
}

module.exports = {
  parseQuotedArguments
};
