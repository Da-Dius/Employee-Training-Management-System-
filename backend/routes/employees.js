const express = require('express');
const { Employee } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

// GET /api/employees
router.get('/', asyncHandler(async (req, res) => {
    const { search, department } = req.query;

    const filter = {};

    if (search) {
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        filter.$or = [
            { name: searchRegex },
            { employee_number: searchRegex },
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

    // Mongoose virtuals don't apply to .lean(), so we manually map 'id'
    const formattedEmployees = employees.map(emp => {
        const { _id, __v, ...rest } = emp;
        return { id: _id.toString(), ...rest };
    });

    res.json(formattedEmployees);
}));

// GET /api/employees/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id).lean();

    if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
    }

    const { _id, __v, ...rest } = employee;
    res.json({ id: _id.toString(), ...rest });
}));

// POST /api/employees
router.post('/', asyncHandler(async (req, res) => {
    const {
        name,
        employee_number,
        department,
        division,
        section,
        station_region,
        email,
    } = req.body;

    if (!name || !employee_number) {
        return res.status(400).json({
            error: 'Name and employee number are required',
        });
    }

    const existingEmployee = await Employee.findOne({
        employee_number: employee_number.trim(),
    });

    if (existingEmployee) {
        return res.status(409).json({
            error: 'An employee with this employee number already exists',
        });
    }

    const employee = await Employee.create({
        name: name.trim(),
        employee_number: employee_number.trim(),
        department: department?.trim() || '',
        division: division?.trim() || '',
        section: section?.trim() || '',
        station_region: station_region?.trim() || '',
        email: email?.trim() || '',
    });

    res.status(201).json(employee); // Global toJSON transformer will handle _id -> id
}));

// PUT /api/employees/:id
router.put('/:id', asyncHandler(async (req, res) => {
    const {
        name,
        employee_number,
        department,
        division,
        section,
        station_region,
        email,
    } = req.body;

    if (!name || !employee_number) {
        return res.status(400).json({
            error: 'Name and employee number are required',
        });
    }

    const duplicate = await Employee.findOne({
        employee_number: employee_number.trim(),
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
            employee_number: employee_number.trim(),
            department: department?.trim() || '',
            division: division?.trim() || '',
            section: section?.trim() || '',
            station_region: station_region?.trim() || '',
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

    res.json(employee); // Global toJSON transformer will handle _id -> id
}));

// DELETE /api/employees/:id
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