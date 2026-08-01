const express = require('express');
const { Employee } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

// GET /api/employees
// Get employees with optional search/filter parameters.
//
// Examples:
// /api/employees
// /api/employees?search=john
// /api/employees?department=Finance
// /api/employees?search=EMP001
router.get('/', asyncHandler(async (req, res) => {
    const { search, department } = req.query;

    const filter = {};

    if (search) {
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        filter.$or = [
            { name: searchRegex },
            { employeeNumber: searchRegex },
            { email: searchRegex },
        ];
    }

    if (department) {
        filter.department = new RegExp(
            department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i'
        );
    }

    const employees = await Employee
        .find(filter)
        .sort({ name: 1 })
        .lean();

    res.json(employees);
}));


// GET /api/employees/:id
// Get one employee by MongoDB ID.
router.get('/:id', asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id).lean();

    if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
}));


// POST /api/employees
// Create a new employee.
router.post('/', asyncHandler(async (req, res) => {
    const {
        name,
        employeeNumber,
        department,
        division,
        section,
        stationRegion,
        email,
    } = req.body;

    if (!name || !employeeNumber) {
        return res.status(400).json({
            error: 'Name and employee number are required',
        });
    }

    const existingEmployee = await Employee.findOne({
        employeeNumber: employeeNumber.trim(),
    });

    if (existingEmployee) {
        return res.status(409).json({
            error: 'An employee with this employee number already exists',
        });
    }

    const employee = await Employee.create({
        name: name.trim(),
        employeeNumber: employeeNumber.trim(),
        department: department?.trim() || '',
        division: division?.trim() || '',
        section: section?.trim() || '',
        stationRegion: stationRegion?.trim() || '',
        email: email?.trim() || '',
    });

    res.status(201).json(employee);
}));


// PUT /api/employees/:id
// Update an employee.
router.put('/:id', asyncHandler(async (req, res) => {
    const {
        name,
        employeeNumber,
        department,
        division,
        section,
        stationRegion,
        email,
    } = req.body;

    if (!name || !employeeNumber) {
        return res.status(400).json({
            error: 'Name and employee number are required',
        });
    }

    const duplicate = await Employee.findOne({
        employeeNumber: employeeNumber.trim(),
        _id: { $ne: req.params.id },
    });

    if (duplicate) {
        return res.status(409).json({
            error: 'Another employee already uses this employee number',
        });
    }

    const employee = await Employee.findByIdAndUpdate(
        req.params.id,
        {
            name: name.trim(),
            employeeNumber: employeeNumber.trim(),
            department: department?.trim() || '',
            division: division?.trim() || '',
            section: section?.trim() || '',
            stationRegion: stationRegion?.trim() || '',
            email: email?.trim() || '',
        },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!employee) {
        return res.status(404).json({
            error: 'Employee not found',
        });
    }

    res.json(employee);
}));


// DELETE /api/employees/:id
// Delete an employee.
router.delete('/:id', asyncHandler(async (req, res) => {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
        return res.status(404).json({
            error: 'Employee not found',
        });
    }

    res.json({
        message: 'Employee deleted successfully',
    });
}));


module.exports = router;