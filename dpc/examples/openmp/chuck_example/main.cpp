
#include <memory>
#include <iostream>
#include <cmath>
#include <omp.h>
using namespace std;
typedef long int idx_t;

// These simple statements are written as inline functions
// to make them easy to change and also be proxies for
// more complicated inline functions in YASK.
inline idx_t mysize(idx_t dx, idx_t dy) {
    return dx * dy;
}
inline float* myalloc(idx_t dx, idx_t dy) {
    return new float[mysize(dx, dy)];
}
inline void myfree(float*& p) {
    delete[] p;
    p = nullptr;
}

// Why is this pragma needed w/icpx? This works on IBM's offload compiler
// w/o it. Seems like it wouldn't be needed with "inline".  Also, if you
// leave out the pragma, there is no useful error msg from icpx.
#pragma omp declare target 
inline idx_t lidx(idx_t dx, idx_t dy, idx_t x, idx_t y) {
    return (y * dx) + x;
}
inline float kfunc(float a, float b) {

    // This works fine.
    //return a + b;

    // Cannot figure out how to get this simple function to work
    // w/icpx.
    float ans;
#pragma forceinline
    ans = std::max(a, b);

    return ans;
//    return a > b ? a : b;
}
#pragma omp end declare target 

template<typename T>
bool within_tolerance(T val, T ref, T epsilon) {
    if (val == ref)
        return true;
    bool ok;
    double adiff = fabs(val - ref);
    if (fabs(ref) > 1.0)
        epsilon = fabs(ref * epsilon);
    ok = adiff < epsilon;
#ifdef DEBUG_TOLERANCE
    if (!ok)
        std::cerr << "outside tolerance of " << epsilon << ": " << val << " != " << ref <<
            " because " << adiff << " >= " << epsilon << std::endl;
#endif
    return ok;
}

void compute(idx_t dx, idx_t dy,
             float* __restrict a, float* __restrict b, float* __restrict c)
{
    idx_t sz = mysize(dx, dy);
    cout << "Offloading " << sz << " calculations...\n" << flush;
    #pragma omp target teams distribute parallel for map(to: a[0:sz], b[0:sz], dx, dy) map(from: c[0:sz])
    //#pragma omp target parallel for map(to: a[0:sz], b[0:sz], dx, dy) map(from: c[0:sz])
    //#pragma omp target teams distribute map(to: a[0:sz], b[0:sz], dx, dy) map(from: c[0:sz])
    for (idx_t x = 0; x < dx; x++) {
        //#pragma omp parallel for simd
        for (idx_t y = 0; y < dy; y++) {
            idx_t i = lidx(dx, dy, x, y);
            c[i] = kfunc(a[i], b[i]);
        }
    }
}

int main(int argc, char* argv[]) {
    idx_t dx = 256, dy = 256;
    if (argc > 1)
        dx = dy = atol(argv[1]);
    if (argc > 2)
        dy = atol(argv[2]);

    idx_t sz = mysize(dx, dy);
    cout << "Allocating " << sz << "-element vars...\n" << flush;
    float* a = myalloc(dx, dy);
    float* b = myalloc(dx, dy);
    float* c = myalloc(dx, dy);

    // Init vars on host.
    // Calc ref result.
    cout << "Initializing " << sz << "-element vars...\n" << flush;
#pragma omp parallel
    for (idx_t x = 0; x < dx; x++) {
#pragma omp simd
        for (idx_t y = 0; y < dy; y++) {
            idx_t i = lidx(dx, dy, x, y);
            a[i] = 0.1f * y + x;
            b[i] = 0.2f * x + y;
        }
    }

    // Offload kernel.
    compute(dx, dy, a, b, c);

    // Compare results.
    cout << "Comparing " << sz << " results...\n" << flush;
    idx_t nerrs = 0;
#pragma omp parallel for reduction(+:nerrs)
    for (idx_t x = 0; x < dx; x++) {
        for (idx_t y = 0; y < dy; y++) {
            idx_t i = lidx(dx, dy, x, y);

            // Reference result.
            auto c1 = kfunc(a[i], b[i]);
            
            if (!within_tolerance(c1, c[i], 1e-6f))
                nerrs++;
        }
    }
    myfree(a);
    myfree(b);
    myfree(c);
    
    cout << "num-errors: " << nerrs << " / " << sz << endl;
    if (nerrs > 0)
        cout << "FAIL\n";
    else
        cout << "PASS\n";
    return nerrs ? 1 : 0;
}

