(function (global, $) {
  "use strict";

  var ToDoList, FlashBag, Database;

  // ToDoList constructor
  ToDoList = function (conf) {
    this.conf = $.extend({
      selector: '.to-do',
      baseClass: 'to-do',
      noDuplicates: true,
      displayFlashes: true,
      allowUndo: true,
      multipleFlashes: false
    }, conf || {});

    // Doing all the things!
    this.initialize();
  };

  // Initializing the instance
  ToDoList.prototype.initialize = function () {
    this.wrapper = $(this.conf.selector);
    this.classes = {
      list: this.conf.baseClass + '__list',
      form: this.conf.baseClass + '__controls',
      listItem: this.conf.baseClass + '__item',
      listItemContent: this.conf.baseClass + '__item-content',
      input: this.conf.baseClass + '__input',
      buttons: {
        remove: this.conf.baseClass + '__remove-btn',
        edit: this.conf.baseClass + '__edit-btn',
        undo: this.conf.baseClass + '__undo-btn',
        submit: this.conf.baseClass + '__submit-btn'
      }
    }
    this.listItemSelector = '.' + this.classes.listItem;
    this.editButtonSelector = '.' + this.classes.buttons.edit;
    this.isEdit = false;
    this.database = new Database({ name: this.conf.baseClass});
    this.flashbag = new FlashBag({
      baseClass: this.conf.baseClass,
      allowUndo: this.conf.allowUndo,
      multipleFlashes: this.conf.multipleFlashes,
      displayFlashes: this.conf.displayFlashes,
      wrapperElement: this.conf.flashWrapperElement,
      flashTypes: this.conf.flashTypes
    });
    this.flashes = {
      'entry.new' : {
        'type': 'success',
        'message': 'New entry added.',
        'undo': false
      },
      'entry.edit' : {
        'type': 'warning',
        'message': 'Entry edited.',
        'undo': true
      },
      'entry.remove' : {
        'type': 'danger',
        'message': 'Entry removed.',
        'undo': true
      },
      'entry.exists' : {
        'type': 'danger',
        'message': 'There is already an entry like this.',
        'undo': false
      },
      'localStorage.success' : {
        'type': 'success',
        'message': 'Entries loaded from LocalStorage.',
        'undo': false
      },
      'localStorage.fail' : {
        'type': 'danger',
        'message': 'LocalStorage not supported; to-do list won\'t be saved.',
        'undo': false
      }
    };

    this.build();
    this.bind();
    this.load();
  };

  // Building the template
  ToDoList.prototype.build = function () {   
    var list, form, input, submitButton;

    list = $('<ul />', {
      'class': this.classes.list
    });
    
    form = $('<form />', {
      'class': this.classes.form,
      'onsubmit': 'return false'
    });

    input = $('<input />', {
      'type': 'text',
      'class': this.classes.input,
      'placeholder': 'insira',
    });

    submitButton = $('<button />', {
      'type': 'submit',
      'class': this.classes.buttons.submit,
      'html': 'Adicionar'
    });
    
    form.append(input, submitButton);
    this.wrapper.append(list, form);
    
    // Caching jQuery selectors
    this.list = $('.' + this.classes.list);
    this.input = $('.' + this.classes.input);
    this.form = $('.' + this.classes.form);
    this.submitButton = $('.' + this.classes.buttons.submit);
  };
  
  // Binding UI actions
  ToDoList.prototype.bind = function () {       
    // Clicking on the main button
    this.submitButton.on('click', $.proxy(function () { 
      var value = this.input.val();
      
      // Edit
      if(this.isEdit) { 
        if(this.editEntry(this.isEdit, value)) {
          this.clean();
          this.wrapper.prepend(this.flashbag.flash(this.flashes['entry.edit']).display());
        }
      } 
        
      // Add
      else {
        if(this.addEntry(null, value)) {
          this.clean();
          this.wrapper.prepend(this.flashbag.flash(this.flashes['entry.new']).display());
        }
      }
        
    }, this));
   
    // Removing an entry
    this.list.on('click', '.' + this.classes.buttons.remove, $.proxy(function(event) {     
      var id, index, flash, entries;

      id = $(event.target).closest(this.listItemSelector).data('id');
      index = this.removeEntry(id);
      entries = $(this.listItemSelector);
      flash = $('<li/>', {
        'class': this.classes.listItem,
        'html': this.flashbag.flash(this.flashes['entry.remove']).display()
      });

      this.clean();
      
      if(index !== false) {
        if(index == entries.length) {
          this.list.append(flash);
        }
        
        else {
          entries.eq(index).before(flash);
        }
      }
    }, this));
    
    // Editing an entry
    this.list.on('click', this.editButtonSelector, $.proxy(function(event) {
      var id = $(event.target).closest(this.listItemSelector).data('id');
      
      if(id === this.isEdit) {
        this.clean();
      }
      
      else { 
        this.clean();
        this.prepare(id);
      }
    }, this));
    
    // Undoing an action
    this.wrapper.on('click', '.' + this.classes.buttons.undo, $.proxy(function(event) {         
      if(this.undo()) {
        $(event.target).closest(this.listItemSelector).remove();
      }
    }, this));
  };

  // Returning to normal add mode
  ToDoList.prototype.clean = function () {
    this.isEdit = false;
    this.input.val('');
    this.submitButton.html('Add');
    $(this.editButtonSelector).html('Edit');
  };

  // Switching to edit mode
  ToDoList.prototype.prepare = function (id) {
    var node = this.findEntry(id);
    this.isEdit = id;
    this.submitButton.html('Edit');
    this.input.val(node.data('value'));
    this.input.focus();
    node.find(this.editButtonSelector).html('Cancel');
  };
  
  // Adding a new entry 
  ToDoList.prototype.addEntry = function (id, value) {
    var listItem, contentItem, removeButton, editButton, isNew;
    isNew = id === null;
    id = id || new Date().valueOf();
    
    // Prevent from duplicate
    if(isNew && this.conf.noDuplicates && this.database.existingValue(value)) {
      this.wrapper.prepend(this.flashbag.flash(this.flashes['entry.exists']).display());
      return false;
    }
    
    // Add entry in database
    if(this.database.persist(id, value)) {    
      listItem = $('<li />', {
        'class': this.classes.listItem,
        'data-id': id,
        'data-value': value
      });
      contentItem = $('<span />', {
        'class': this.classes.listItemContent,
        'html': value
      });
      removeButton = $('<button />', {
        'class': this.classes.buttons.remove,
        'html': 'Remove'
      });
      editButton = $('<button />', {
        'class': this.classes.buttons.edit,
        'html': 'Edit'
      });
    
      listItem.append(contentItem, removeButton, editButton);
           
      if(isNew || $(this.listItemSelector).length === 0) {
        this.list.prepend(listItem);
      }
      
      // If item belongs somewhere else than at the first index
      else {     
        this.insertInside(id, listItem);
      }

      return id;
    }

    return false;
  };
  
  // Edit an entry
  ToDoList.prototype.editEntry = function (id, value) {
    var entry = this.findEntry(id);

    // Prevent from duplicates
    if(this.conf.noDuplicates && this.database.existingValue(value)) {
      this.wrapper.prepend(this.flashbag.flash(this.flashes['entry.exists']).display());
      return false;
    }
    
    // Update entry in database
    if(this.database.persist(id, value)) {
      entry.find('.' + this.classes.listItemContent).html(value);
      entry.data('value', value);
      return id;
    }

    return false;
  };
  
  // Remove an entry
  ToDoList.prototype.removeEntry = function (id) {      
    var entry = this.findEntry(id), 
        index = entry.index();

    // Delete entry from database
    if(this.database.persist(id, null) !== false) {
      entry.remove();
      return index;
    }
    return false;
  };
  
  // Get entry by id
  ToDoList.prototype.findEntry = function (id) {
    return $('[data-id="' + id + '"]');
  };  
  
  // Undo last action
  ToDoList.prototype.undo = function () {   
    var lastAction = this.database.history.pop();
    switch(lastAction.type) {
      case 'A':
        return this.removeEntry(lastAction.id);
        
      case 'E':
        return this.editEntry(lastAction.id, lastAction.value);
        
      case 'R':
        return this.addEntry(lastAction.id, lastAction.value);
        
      default:
        return false;
    }
  };

  // Loading entry from localStorage
  ToDoList.prototype.load = function () {
    if(!this.database.hasLocalStorage) {
      this.wrapper.prepend(this.flashbag.flash(this.flashes['localStorage.fail']).display());
      return;
    }
    
    var i, len, 
        entries = this.database.entries;
    if(entries !== null && entries.length > 0) {
      for(i = 0, len = entries.length; i < len; i++) {
        this.addEntry(entries[i].id, entries[i].value);
      }
      this.wrapper.prepend(this.flashbag.flash(this.flashes['localStorage.success']).display());
    }
  };
  
  // Reseting the whole app
  ToDoList.prototype.reset = function () {
    this.database.clear();
  };

  // Insert inside
  ToDoList.prototype.insertInside = function (id, node) {
    var entry, _id, j, entries, isAdded;
    
    entries = $(this.listItemSelector);
    isAdded = false;
    
    for(j = 0; j < entries.length; j++) { 
      entry = $(entries[j]);
      _id = entry.data('id');
        
      if(typeof _id !== "undefined" && id > _id) {
        entry.before(node);
        isAdded = true;
        break;
      }
    }
        
    if(!isAdded) {
      this.list.append(node);
    }
      
    return true;
  };
  
  
  // Flashbag constructor
  FlashBag = function(conf) {
    this.conf = $.extend({
      baseClass:            'to-do',
      displayFlashes:       true,
      multipleFlashes:      true,
      allowUndo:            true
    }, conf || {});

    // Doing all the things!
    this.initialize();
  };
  
  // Initialize
  FlashBag.prototype.initialize = function () {
    this.flashes = [];
    this.classes = {
      undoButton: this.conf.baseClass + '__undo-btn',
      default: this.conf.baseClass + '__flash'
    };
  };
  
  // Displaying a flash
  FlashBag.prototype.display = function () {
    var flash, node, undoButton;
    
    flash = this.flashes.pop();
    node = $('<p />', {
      'class': this.classes.default + ' ' + this.classes.default + '--' + flash.type,
      'html': flash.message
    });
        
    if(this.conf.allowUndo && flash.undo) {
      undoButton = $('<button />', {
        'class': this.classes.undoButton,
        'html': 'Undo'
      });
      
      node.append(undoButton);
    }
    
    if(!this.conf.multipleFlashes) {
      $('.' + this.classes.default).remove();
    }
    
    return node;
  };

  // Adding a new flash
  FlashBag.prototype.flash = function (data) {
    var flash = {
      'type': data.type,
      'message': data.message,
      'undo': data.undo
    };

    if(data.message !== null) {
      this.flashes.push(flash);
    }
    
    return this;
  };


  // Database constructor
  Database = function(conf) {
    this.conf = $.extend({
      'name': 'ToDo'
    }, conf || {});

    this.initialize();
  };

  // Initialize
  Database.prototype.initialize = function () {
    this.hasLocalStorage = typeof global.localStorage !== "undefined";
    this.entries = this.load() || [];
    this.history  = [];
  };

  // Persist to database
  Database.prototype.persist = function (id, value) {
    var result = false;
    
    if(this.getEntry(id) !== null) {
      result = value !== null ? this.editEntry(id, value) : this.removeEntry(id);
    } 
    else {
      result = value !== null ? this.addEntry(id, value) : false;
    }

    if(result !== false) {
      this.save();
    }
    return result;
  };

  // Add an entry to database
  Database.prototype.addEntry = function (id, value) {
    var entry = this.getEntry(id);
    if(entry === null && value !== null) {
      entry = {
        'id': id, 
        'value': value
      };
      this.entries.push(entry);
      this.history.push({ 
        'id': id, 
        'value': value,
        'type': 'A'
      });
      return entry;
    }
  };
  
  // Edit an entry from database
  Database.prototype.editEntry = function (id, value) {
    var entry = this.getEntry(id);
    if(entry !== null && value !== null) {
      if(value !== entry.value) {
        this.history.push({
        'type': 'E',
        'id': entry.id, 
        'value': entry.value 
        });
        entry.value = value;
      }
      return entry;
    }
  };

  // Remove an entry from database
  Database.prototype.removeEntry = function (id) {
    var entry = this.getEntry(id),
        index = this.entries.indexOf(entry);
    if(index !== -1) {
      this.entries.splice(index, 1);
      this.history.push({
        'type': 'R',
        'id': entry.id, 
        'value': entry.value 
      });
      return index;
    }
  };

  // Return entry from id
  Database.prototype.getEntry = function (id) {
    var i, len, entry;
    for(i = 0, len = this.entries.length; i < len; i++) {
      entry = this.entries[i];
      if(entry.id === id) {
        return entry;
      }
    }
    return null;
  };

  // Checking if value exists in database
  Database.prototype.existingValue = function (value) {
    var i, len, entry;

    for(i = 0, len = this.entries.length; i < len; i++) {
      entry = this.entries[i];
      if(entry.value === value) {
        return entry;
      }
    }

    return false;
  };

  // Storing entries to LocalStorage
  Database.prototype.save = function () {
    if(this.hasLocalStorage) {
      global.localStorage.setItem(this.conf.name, JSON.stringify(this.entries));
    }
    return false;
  };

  // Loading entries from LocalStorage
  Database.prototype.load = function () {    
    if(typeof global.localStorage.getItem(this.conf.name) !== null) {
      return JSON.parse(global.localStorage.getItem(this.conf.name));
    }
  };
  
  // Dropping the database
  Database.prototype.clear = function () {
    this.entries.length = 0;
    this.history.length = 0;
    global.localStorage.removeItem(this.conf.name);
  };
  
  global.ToDoList = ToDoList;
  global.FlashBag = FlashBag;
  global.Database = Database;
}(window, jQuery));


var todo = new ToDoList();