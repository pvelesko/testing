#ifndef _cg_solve_hpp_
#define _cg_solve_hpp_

//@HEADER
// ************************************************************************
//
// MiniFE: Simple Finite Element Assembly and Solve
// Copyright (2006-2013) Sandia	Corporation
//
// Under terms of Contract DE-AC04-94AL85000, there is a non-exclusive
// license for use of this work by or on behalf of the U.S. Government.
//
// This library is free software; you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as
// published by the Free Software Foundation; either version 2.1 of the
// License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307
// USA
//
// ************************************************************************
//@HEADER

#include <cmath>
#include <limits>

#include <Vector_functions.hpp>
#include <mytimer.hpp>

#include <outstream.hpp>

#ifdef HAVE_MPI
#include <mpi.h>
#endif

namespace miniFE {

template<typename Scalar>
void print_vec(const std::vector<Scalar>& vec, const std::string& name)
{
  for(size_t i=0; i<vec.size(); ++i) {
    std::cout << name << "["<<i<<"]: " << vec[i] << std::endl;
  }
}

template<typename VectorType>
bool breakdown(cl::sycl::queue Queue,
               typename VectorType::ScalarType inner,
               VectorType& v,
               VectorType& w)
{
  typedef typename VectorType::ScalarType Scalar;
  typedef typename TypeTraits<Scalar>::magnitude_type magnitude;

//This is code that was copied from Aztec, and originally written
//by my hero, Ray Tuminaro.
//
//Assuming that inner = <v,w> (inner product of v and w),
//v and w are considered orthogonal if
//  |inner| < 100 * ||v||_2 * ||w||_2 * epsilon

  magnitude vnorm = std::sqrt(dot_r2(Queue,v));
  magnitude wnorm = std::sqrt(dot_r2(Queue,w));
  return std::abs(inner) <= 100*vnorm*wnorm*std::numeric_limits<magnitude>::epsilon();
}

template<typename OperatorType,
         typename VectorType,
         typename Matvec>
void
cg_solve(OperatorType& A,
         VectorType& b,
         VectorType& x,
         Matvec matvec,
         typename OperatorType::LocalOrdinalType max_iter,
         typename TypeTraits<typename OperatorType::ScalarType>::magnitude_type& tolerance,
         typename OperatorType::LocalOrdinalType& num_iters,
         typename TypeTraits<typename OperatorType::ScalarType>::magnitude_type& normr,
         timer_type* my_cg_times)
{
  typedef typename OperatorType::ScalarType ScalarType;
  typedef typename OperatorType::GlobalOrdinalType GlobalOrdinalType;
  typedef typename OperatorType::LocalOrdinalType LocalOrdinalType;
  typedef typename TypeTraits<ScalarType>::magnitude_type magnitude_type;

  timer_type t0 = 0, tWAXPY = 0, tDOT = 0, tMATVEC = 0, tMATVECDOT = 0;
  timer_type total_time = mytimer();

  int myproc = 0;
#ifdef HAVE_MPI
  MPI_Comm_rank(MPI_COMM_WORLD, &myproc);
#endif

  if (!A.has_local_indices) {
    std::cerr << "miniFE::cg_solve ERROR, A.has_local_indices is false, needs to be true. This probably means "
       << "miniFE::make_local_matrix(A) was not called prior to calling miniFE::cg_solve."
       << std::endl;
    return;
  }

  const size_t nrows = A.rows.size();
  const LocalOrdinalType ncols = A.num_cols;
  const LocalOrdinalType rows_size = (LocalOrdinalType) A.rows.size();

  VectorType r(b.startIndex, nrows);
  VectorType p(0, ncols);
  VectorType Ap(b.startIndex, nrows);

  normr = 0.0;
  magnitude_type rtrans = 0.0;
  magnitude_type oldrtrans = 0.0;

  LocalOrdinalType print_freq = max_iter/10;
  if (print_freq>50) print_freq = 50;
  if (print_freq<1)  print_freq = 1;

  ScalarType one = 1.0;
  ScalarType zero = 0.0;

  magnitude_type alpha = 0.0;
  magnitude_type p_ap_dot = 0.0;

  cl::sycl::queue Queue;
  auto device = Queue.get_device();
  std::cout << "Offload to " << device.get_info<cl::sycl::info::device::name>() << std::endl;
  std::cout << "max_work_group_size : " << device.get_info<cl::sycl::info::device::max_work_group_size>() << std::endl;
  std::cout << "max_compute_units : " << device.get_info<cl::sycl::info::device::max_compute_units>() << std::endl;
  std::cout << "native_vector_width_float " << device.get_info<cl::sycl::info::device::native_vector_width_float>() << std::endl;
  std::cout << "preferred_vector_width_float " << device.get_info<cl::sycl::info::device::preferred_vector_width_float>() << std::endl;
  cl::sycl::id<3> wisizes = device.get_info<cl::sycl::info::device::max_work_item_sizes>();
  std::cout << "max_work_item_sizes (" << wisizes[0] << ", " << wisizes[1] << ", " << wisizes[2] <<")" << std::endl;
  std::cout << "max_clock_frequency " << device.get_info<cl::sycl::info::device::max_clock_frequency>() << std::endl;
  std::cout << "max_mem_alloc_size " << device.get_info<cl::sycl::info::device::max_mem_alloc_size>() << std::endl;
  std::cout << "max_parameter_size " << device.get_info<cl::sycl::info::device::max_parameter_size>() << std::endl;
  std::cout << "global_mem_cache_size " << device.get_info<cl::sycl::info::device::global_mem_cache_size>() << std::endl;
  std::cout << "global_mem_size " << device.get_info<cl::sycl::info::device::global_mem_size>() << std::endl;
  std::cout << "local_mem_size " << device.get_info<cl::sycl::info::device::local_mem_size>() << std::endl;

  //Seems like we should be able to do this in Vector.hpp/ELLMatrix.hpp/CSRMatrix.hpp, but it doesn't work...
  int n =x.coefs.size();
  cl::sycl::buffer<MINIFE_SCALAR> dev_Ap(Ap.coefs.data(), cl::sycl::range<1>(Ap.coefs.size())); Ap.device_coefs = dev_Ap;
  cl::sycl::buffer<MINIFE_SCALAR> dev_x(x.coefs.data(), cl::sycl::range<1>(x.coefs.size())); x.device_coefs = dev_x;
  cl::sycl::buffer<MINIFE_SCALAR> dev_b(b.coefs.data(), cl::sycl::range<1>(b.coefs.size())); b.device_coefs = dev_b;
  cl::sycl::buffer<MINIFE_SCALAR> dev_r(r.coefs.data(), cl::sycl::range<1>(r.coefs.size())); r.device_coefs = dev_r;
  cl::sycl::buffer<MINIFE_SCALAR> dev_p(p.coefs.data(), cl::sycl::range<1>(p.coefs.size())); p.device_coefs = dev_p;
#ifdef MINIFE_CSR_MATRIX
  cl::sycl::buffer<MINIFE_SCALAR> dev_coefs(A.packed_coefs.data(), cl::sycl::range<1>(A.packed_coefs.size())); A.device_coefs = dev_coefs;
  cl::sycl::buffer<MINIFE_GLOBAL_ORDINAL> dev_cols(A.packed_cols.data(), cl::sycl::range<1>(A.packed_cols.size())); A.device_cols = dev_cols;
  cl::sycl::buffer<MINIFE_LOCAL_ORDINAL> dev_cols(A.row_offsets.data(), cl::sycl::range<1>(A.row_offsets.size())); A.device_row_offsets = dev_row_offsets;
#elif MINIFE_ELL_MATRIX
  cl::sycl::buffer<MINIFE_SCALAR> dev_coefs(A.coefs.data(), cl::sycl::range<1>(A.coefs.size())); A.device_coefs = dev_coefs;
  cl::sycl::buffer<MINIFE_GLOBAL_ORDINAL> dev_cols(A.cols.data(), cl::sycl::range<1>(A.cols.size())); A.device_cols = dev_cols;
#endif

//auto tmp = p.device_coefs.template get_access<cl::sycl::access::mode::read>(); double sum=0.0; for (int i = 0; i < n; i++) sum += tmp[i]; printf("%f \n", sum);

/// temporary for PVC simulation  next line should not appear
//  TICK(); rtrans = dot(Queue, x, b); TOCK(tDOT);

  TICK(); waxpby(Queue, one, x, zero, x, p); TOCK(tWAXPY);

  TICK(); matvec(Queue, A, p, Ap); TOCK(tMATVEC);

  TICK(); waxpby(Queue, one, b, -one, Ap, r); TOCK(tWAXPY);

  TICK(); rtrans = dot_r2(Queue, r); TOCK(tDOT);

  normr = sqrt(rtrans);

  if (myproc == 0) {
    std::cout << "Initial Residual = "<< normr << std::endl;
  }

  magnitude_type brkdown_tol = std::numeric_limits<magnitude_type>::epsilon();

  bool stop = false;
  //for(LocalOrdinalType k = 1; k <= max_iter && normr > tolerance && !stop; ++k) {
  for(LocalOrdinalType k = 1; k <= max_iter; ++k) {
    if (k == 1) {
      TICK(); daxpby(Queue, one, r, zero, p); TOCK(tWAXPY);
    } else {
      oldrtrans = rtrans;
      TICK(); rtrans = dot_r2(Queue, r); TOCK(tDOT);
      magnitude_type beta = rtrans/oldrtrans;
      TICK(); daxpby(Queue, one, r, beta, p); TOCK(tWAXPY);
    }

    normr = sqrt(rtrans);

    if (myproc == 0 && (k%print_freq==0 || k==max_iter)) {
      std::cout << "Iteration = "<<k<<"   Residual = "<<normr<<std::endl;
    }

    magnitude_type alpha = 0.0;
    magnitude_type p_ap_dot = 0.0;

    TICK(); matvec(Queue, A, p, Ap); TOCK(tMATVEC);

    TICK(); p_ap_dot = dot(Queue, Ap, p); TOCK(tDOT);

    if (p_ap_dot < brkdown_tol) {
      if (p_ap_dot < 0 || breakdown(Queue, p_ap_dot, Ap, p)) {
        std::cerr << "miniFE::cg_solve ERROR, numerical breakdown!"<<std::endl;
        //update the timers before jumping out.
        my_cg_times[WAXPY] = tWAXPY;
        my_cg_times[DOT] = tDOT;
        my_cg_times[MATVEC] = tMATVEC;
        my_cg_times[TOTAL] = mytimer() - total_time;
        stop = true;
      }
      else brkdown_tol = 0.1 * p_ap_dot;
    }
    alpha = rtrans/p_ap_dot;

    TICK(); daxpby(Queue, alpha, p, one, x);
            daxpby(Queue, -alpha, Ap, one, r); TOCK(tWAXPY);

    num_iters = k;

  }

  my_cg_times[WAXPY] = tWAXPY;
  my_cg_times[DOT] = tDOT;
  my_cg_times[MATVEC] = tMATVEC;
  my_cg_times[MATVECDOT] = tMATVECDOT;
  my_cg_times[TOTAL] = mytimer() - total_time;

  if (myproc == 0) {
    std::cout << "\n  TOTAL    MATVEC   DOT   WAXPY\n";
    std::cout << "  " << my_cg_times[TOTAL];
    std::cout << "  " << tMATVEC;
    std::cout << "  " << tDOT;
    std::cout << "  " << tWAXPY;
    std::cout << "\n";
  }

}

}//namespace miniFE

#endif
