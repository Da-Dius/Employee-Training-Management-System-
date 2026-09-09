const express = require('express');
const { Department, Employee, Nominee } = require('../db/database');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

function asyncHandler(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

// GET - all departments
router.get('/', asyncHandler(async (req, res) => {
    const departments = await Department.find().sort({ name: 1 }).lean();

    // mapping _id to id for frontend compatibility
    const formatted = departments.map(dept => {
        const { _id, __v, ...rest } = dept;
        return { id: _id.toString(), ...rest };
    });
    res.json(formatted);
}));

// POST - create a new department
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim())
        return res.status(400).json({ error: 'Department name is required' });

    const existing = await Department.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (existing) {
        return res.status(409).json({ error: 'Departmentalready exists' });
    }

    const department = await Department.create({ name: name.trim() });
    res.status(201).json(department);
}));

// PUT - update department
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim())
        return res.status(400).json({ error: 'Department name is required' });

    const duplicate = await Department.findOne({
        name: new RegExp(`^${name.trim()}$`, 'i'),
        _id: { $ne: req.params.id }
    });

    if (duplicate)
        return res.status(409).json({ error: 'Another department with that name already exists' });

    const oldDept = await Department.findById(req.params.id);
    if (!oldDept)
        return res.status(404).json({ error: 'Department not found' });

    const oldName = oldDept.name;
    const newName = name.trim();

    const updated = await Department.findByIdAndUpdate(req.params.id, { name: newName }, { new: true });

    // Update all employees and nominees with the old department name
    if (oldName !== newName) {
        await Employee.updateMany({ department: oldName }, { department: newName });
        await Nominee.updateMany({ department: oldName }, { department: newName });
    }

    res.json(updated);
}));

// DELETE - delete department
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id);
    if (!department)
        return res.status(404).json({ error: 'Department not found' });

    // Prevent deletion if employees are currently using it
    const employeesUsingDept = await Employee.exists({ department: department.name });
    if (employeesUsingDept) {
        return res.status(400).json({ error: 'Cannot delete department because employees are currently assigned to it.' });
    }

    await Department.findByIdAndDelete(req.params.id);
    res.status(204).end();
}));

module.exports = router;