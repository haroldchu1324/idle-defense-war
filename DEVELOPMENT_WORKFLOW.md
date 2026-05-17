# 🛡️ SAFE DEVELOPMENT WORKFLOW

## 🌿 BRANCHING STRATEGY

### **Main Branch (Production)**
- `main` = Always working, stable game
- NEVER edit directly on main
- Only merge tested features

### **Development Branches**
Create new branches for each feature:

```bash
# Create and switch to new feature branch
git checkout -b feature/enhanced-research
git checkout -b feature/new-buildings  
git checkout -b bugfix/resource-display

# Work on your changes...
# Test thoroughly...

# If it works - merge to main:
git checkout main
git merge feature/enhanced-research
git branch -d feature/enhanced-research  # Clean up

# If it breaks - just switch back to main:
git checkout main
# Your working game is safe!
```

## 🔄 DEVELOPMENT WORKFLOW

### **1. Before Making Changes:**
```bash
# Make sure you're on main and it's clean
git checkout main
git status  # Should be clean

# Create new branch for your feature
git checkout -b feature/your-new-feature
```

### **2. During Development:**
```bash
# Save progress frequently
git add .
git commit -m "WIP: working on new research system"

# Test your changes
# If it breaks, you can always:
git checkout main  # Back to safety!
```

### **3. When Feature is Done:**
```bash
# Test thoroughly first!
# If everything works:
git checkout main
git merge feature/your-new-feature

# If it works in main:
git branch -d feature/your-new-feature  # Clean up

# If it breaks in main:
git reset --hard HEAD~1  # Undo the merge
git checkout feature/your-new-feature  # Fix issues
```

## 🚀 QUICK COMMANDS

### **Start New Feature:**
```bash
git checkout main
git checkout -b feature/NAME-OF-FEATURE
```

### **Save Progress:**
```bash
git add .
git commit -m "Describe what you did"
```

### **Back to Safety:**
```bash
git checkout main
```

### **Test Multiple Versions:**
```bash
# Switch between versions instantly:
git checkout main           # Stable version
git checkout feature/test   # Experimental version
```

## 📋 SAFETY CHECKLIST

✅ Always work on feature branches, never on main  
✅ Commit working states frequently  
✅ Test thoroughly before merging to main  
✅ Keep main branch always deployable  
✅ Use descriptive commit messages  

## 🆘 EMERGENCY RECOVERY

If you ever break main:
```bash
git log --oneline  # Find last working commit
git reset --hard COMMIT-ID  # Go back to that commit
```

## 🎯 EXAMPLE WORKFLOW

```bash
# 1. Start new feature
git checkout main
git checkout -b feature/enhanced-research

# 2. Make changes to index.html
# 3. Test - if it breaks:
git checkout main  # Safe!

# 4. Keep working on branch:
git checkout feature/enhanced-research
# Fix issues, test again

# 5. When perfect:
git checkout main
git merge feature/enhanced-research
```

**Never lose working code again!** 🛡️