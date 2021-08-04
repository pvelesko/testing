#define DEBUG 1
#define __CL_ENABLE_EXCEPTIONS
#define N 4
#include <CL/cl.h>
#include <stdlib.h>
#include <stdio.h>
#define HTYPE int
#define MAX_SOURCE_SIZE 100000

int main()
{
    cl_int err;

    // Set up platform 
    cl_platform_id firstPlatformID;
    cl_uint numPlatforms = 0;
    err = clGetPlatformIDs(1, &firstPlatformID, &numPlatforms);
    if (err != CL_SUCCESS) printf("failed to query platforms. Error:%i\n", err);

    // Set up device
    cl_device_id device_id;
    err = clGetDeviceIDs(firstPlatformID, CL_DEVICE_TYPE_CPU, 1, &device_id, NULL);
    if (err != CL_SUCCESS) printf("failed to init device. Error:%i\n", err);

    cl_context context = clCreateContext(NULL, 1, &device_id, NULL, NULL, &err);
    if (err != CL_SUCCESS) printf("failed to init context. Error:%i\n", err);

    // define data
    HTYPE a_h[N], b_h[N], c_h[N];
    for (int i = 0; i < N; i++)
    {
        a_h[i] = i;
        b_h[i] = i;
        c_h[i] = 0;
    }

    // create data buffers
    cl_mem a_d = clCreateBuffer(context, CL_MEM_READ_ONLY | CL_MEM_COPY_HOST_PTR, N * sizeof(HTYPE), a_h, &err);
    if (err != CL_SUCCESS) printf("failed to create memory buffer. Error:%i\n", err);
    cl_mem b_d = clCreateBuffer(context, CL_MEM_READ_ONLY | CL_MEM_COPY_HOST_PTR, N * sizeof(HTYPE), b_h, &err);
    if (err != CL_SUCCESS) printf("failed to create memory buffer. Error:%i\n", err);
    cl_mem c_d = clCreateBuffer(context, CL_MEM_WRITE_ONLY | CL_MEM_HOST_READ_ONLY | CL_MEM_COPY_HOST_PTR, N * sizeof(HTYPE), c_h, &err);
    if (err != CL_SUCCESS) printf("failed to create memory buffer. Error:%i\n", err);
    
    // acquire kernel source
    FILE* vadd_source_file = fopen("vadd.cl", "rb");
    if (vadd_source_file == NULL) printf("Failed to lead kernel source\n");
    const char* vadd_source = (char*) malloc(MAX_SOURCE_SIZE);
    size_t source_size = fread((void*)vadd_source, 1, MAX_SOURCE_SIZE, vadd_source_file);
    if (DEBUG) printf("%s", vadd_source);
    cl_program vadd_kernel_program = clCreateProgramWithSource(context, 1, &vadd_source, NULL, &err);
    if (err != CL_SUCCESS) printf("Failed to create OpenCL program %d\n", err);


    // compile kernel
    const char opts[1000] = {}; // custom compilation flags can go here
    err =clBuildProgram(vadd_kernel_program, 1, &device_id, opts, NULL, NULL);
    if (err != CL_SUCCESS) printf("Failed to compile OpenCL program %d\n", err);
    if (err == CL_BUILD_PROGRAM_FAILURE) {
        // Determine the size of the log
        size_t log_size;
        clGetProgramBuildInfo(vadd_kernel_program, device_id, CL_PROGRAM_BUILD_LOG, 0, NULL, &log_size);

        // Allocate memory for the log
        char *log = (char *) malloc(log_size);

        // Get the log
        clGetProgramBuildInfo(vadd_kernel_program, device_id, CL_PROGRAM_BUILD_LOG, log_size, log, NULL);

        // Print the log
        printf("%s\n", log);
    }

    cl_kernel vadd_cl = clCreateKernel(vadd_kernel_program, "vadd", &err);
    if (err != CL_SUCCESS) printf("failed to create kernel\n");

    err = clSetKernelArg(vadd_cl, 0, sizeof(a_d), (void*)&a_d);
    if (err != CL_SUCCESS) printf("failed to set arg 0 %i\n", err);
    err = clSetKernelArg(vadd_cl, 1, sizeof(b_d), (void*)&b_d);
    if (err != CL_SUCCESS) printf("failed to set arg 1 %i\n", err);
    err = clSetKernelArg(vadd_cl, 2, sizeof(c_d), (void*)&c_d);
    if (err != CL_SUCCESS) printf("failed to set arg 2 %i\n", err);

    //create command queueu 
    cl_command_queue q = clCreateCommandQueue(context, device_id, 0, &err);
    if (err != CL_SUCCESS) printf("failed to create command queue\n");


    size_t global = N;
    err = clEnqueueNDRangeKernel(q, vadd_cl, 1, NULL, &global, NULL, 0, NULL, NULL);
    if (err != CL_SUCCESS) printf("failed to enqueue vadd %i \n", err);

    err = clEnqueueReadBuffer(q, c_d, CL_TRUE, 0, N * sizeof(HTYPE), c_h, 0, NULL, NULL);
    if (err != CL_SUCCESS) printf("failed to enqueue read %i \n", err);

    for (int i = 0; i < N; i++) printf("c[%i] = a[%i] + b[%i] = %i + %i = %i\n", i, i, i, a_h[i], b_h[i], c_h[i]);
    return 0;
}
