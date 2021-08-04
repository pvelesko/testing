#ifndef _Vector_functions_hpp_
#define _Vector_functions_hpp_

//@HEADER
// ************************************************************************
//
// MiniFE: Simple Finite Element Assembly and Solve
// Copyright (2006-2013) Sandia Corporation
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

#include <vector>
#include <sstream>
#include <fstream>

#ifdef HAVE_MPI
#include <mpi.h>
#endif

#ifdef MINIFE_HAVE_TBB
#include <LockingVector.hpp>
#endif

#include <TypeTraits.hpp>
#include <Vector.hpp>

#define MINIFE_MIN(X, Y)  ((X) < (Y) ? (X) : (Y))

namespace miniFE {


template<typename VectorType>
void write_vector(const std::string& filename,
                  const VectorType& vec)
{
  int numprocs = 1, myproc = 0;
#ifdef HAVE_MPI
  MPI_Comm_size(MPI_COMM_WORLD, &numprocs);
  MPI_Comm_rank(MPI_COMM_WORLD, &myproc);
#endif

  std::ostringstream osstr;
  osstr << filename << "." << numprocs << "." << myproc;
  std::string full_name = osstr.str();
  std::ofstream ofs(full_name.c_str());

  typedef typename VectorType::ScalarType ScalarType;

  const std::vector<ScalarType>& coefs = vec.coefs;
  for(int p=0; p<numprocs; ++p) {
    if (p == myproc) {
      if (p == 0) {
        ofs << vec.local_size << std::endl;
      }

      typename VectorType::GlobalOrdinalType first = vec.startIndex;
      for(size_t i=0; i<vec.local_size; ++i) {
        ofs << first+i << " " << coefs[i] << std::endl;
      }
    }
#ifdef HAVE_MPI
    MPI_Barrier(MPI_COMM_WORLD);
#endif
  }
}

template<typename VectorType>
void sum_into_vector(size_t num_indices,
                     const typename VectorType::GlobalOrdinalType* indices,
                     const typename VectorType::ScalarType* coefs,
                     VectorType& vec)
{
  typedef typename VectorType::GlobalOrdinalType GlobalOrdinal;
  typedef typename VectorType::ScalarType Scalar;

  GlobalOrdinal first = vec.startIndex;
  GlobalOrdinal last = first + vec.local_size - 1;

  std::vector<Scalar>& vec_coefs = vec.coefs;

  for(size_t i=0; i<num_indices; ++i) {
    if (indices[i] < first || indices[i] > last) continue;
    size_t idx = indices[i] - first;

    #pragma omp atomic
    vec_coefs[idx] += coefs[i];
  }
}

#ifdef MINIFE_HAVE_TBB
template<typename VectorType>
void sum_into_vector(size_t num_indices,
                     const typename VectorType::GlobalOrdinalType* indices,
                     const typename VectorType::ScalarType* coefs,
                     LockingVector<VectorType>& vec)
{
  vec.sum_in(num_indices, indices, coefs);
}
#endif

//------------------------------------------------------------
//Compute the update of a vector with the sum of two scaled vectors where:
//
// w = alpha*x + beta*y
//
// x,y - input vectors
//
// alpha,beta - scalars applied to x and y respectively
//
// w - output vector
//
template<typename VectorType>
void
waxpby(cl::sycl::queue Queue, typename VectorType::ScalarType alpha, VectorType& x,
         typename VectorType::ScalarType beta, VectorType& y,
         VectorType& w)
{
  typedef typename VectorType::ScalarType ScalarType;

  const int n = x.coefs.size();

  auto device = Queue.get_device();
  int items_per_group = device.get_info<cl::sycl::info::device::max_work_group_size>();
  int groups = (n + items_per_group - 1) / items_per_group;
  int items = groups * items_per_group;
  cl::sycl::nd_range<1> ndRange(items, items_per_group);

  Queue.submit([&](cl::sycl::handler &cgh) {

      auto wcoefs = w.device_coefs.template get_access<cl::sycl::access::mode::write>(cgh);
      auto xcoefs = x.device_coefs.template get_access<cl::sycl::access::mode::read>(cgh);
      auto ycoefs = y.device_coefs.template get_access<cl::sycl::access::mode::read>(cgh);

      cgh.parallel_for<class waxpby>(ndRange, [=](cl::sycl::nd_item<1> item) {
          int i = item.get_global_id(0);
          if (i < n) {
            if(beta == 0.0) {
              if(alpha == 1.0) {
                wcoefs[i] = xcoefs[i];
              } else {
                wcoefs[i] = alpha * xcoefs[i];
              }
            } else {
              if(alpha == 1.0) {
                wcoefs[i] = xcoefs[i] + beta * ycoefs[i];
              } else {
                wcoefs[i] = alpha * xcoefs[i] + beta * ycoefs[i];
              }
            }
          }
        });
    });

}

template<typename VectorType>
void
daxpby(cl::sycl::queue Queue,
        MINIFE_SCALAR alpha,
	VectorType& x,
	MINIFE_SCALAR beta,
	VectorType& y)
{

  const MINIFE_LOCAL_ORDINAL n = MINIFE_MIN(x.coefs.size(), y.coefs.size());

  auto device = Queue.get_device();
  int items_per_group = device.get_info<cl::sycl::info::device::max_work_group_size>();
  int groups = (n + items_per_group - 1) / items_per_group;
  int items = groups * items_per_group;
  cl::sycl::nd_range<1> ndRange(items, items_per_group);

  Queue.submit([&](cl::sycl::handler &cgh) {
      auto xcoefs = x.device_coefs.template get_access<cl::sycl::access::mode::read>(cgh);
      auto ycoefs = y.device_coefs.template get_access<cl::sycl::access::mode::read_write>(cgh);
      cgh.parallel_for<class daxpby>(ndRange, [=](cl::sycl::nd_item<1> item) {
          int i = item.get_global_id(0);
          if (i < n) {
            if(alpha == 1.0 && beta == 1.0) {
              ycoefs[i] += xcoefs[i];
            } else if (beta == 1.0) {
              ycoefs[i] += alpha * xcoefs[i];
            } else if (alpha == 1.0) {
              ycoefs[i] = xcoefs[i] + beta * ycoefs[i];
            } else if (beta == 0.0) {
              ycoefs[i] = alpha * xcoefs[i];
            } else {
              ycoefs[i] = alpha * xcoefs[i] + beta * ycoefs[i];
            }
          }
        });
    });

}

//-----------------------------------------------------------
//Compute the dot product of two vectors where:
//
// x,y - input vectors
//
// result - return-value
//
template<typename Vector>
typename TypeTraits<typename Vector::ScalarType>::magnitude_type
  dot(cl::sycl::queue Queue,
      Vector& x,
      Vector& y)
{
  const MINIFE_LOCAL_ORDINAL n = x.coefs.size();

  typedef typename Vector::ScalarType Scalar;
  typedef typename TypeTraits<typename Vector::ScalarType>::magnitude_type magnitude;

  auto device = Queue.get_device();
  int items_per_group = device.get_info<cl::sycl::info::device::max_work_group_size>();
#if 0
  int groups = (n + items_per_group - 1) / items_per_group;
  int items = groups * items_per_group;
  int elements_per_item = 1;
#else
  int groups = 64;
  int items = groups * items_per_group;
  int elements_per_item = (n + items - 1) / items;
#endif
  cl::sycl::nd_range<1> ndRange(items, items_per_group);
  std::vector<magnitude> output(groups);
  for (int i = 0; i < groups; i++) output[i] = 0.0;
  cl::sycl::buffer<magnitude> out_buff(output.data(), cl::sycl::range<1>(groups));

  Queue.submit([&](cl::sycl::handler &cgh) {
      auto xcoefs = x.device_coefs.template get_access<cl::sycl::access::mode::read>(cgh);
      auto ycoefs = y.device_coefs.template get_access<cl::sycl::access::mode::read>(cgh);
      auto local = cl::sycl::accessor<float, 1, cl::sycl::access::mode::read_write, cl::sycl::access::target::local> (cl::sycl::range<1>(items_per_group),cgh);
      auto out_acc = out_buff.template get_access<cl::sycl::access::mode::write>(cgh);
      cgh.parallel_for<class dot>(ndRange, [=](cl::sycl::nd_item<1> item) {
          int local_id = item.get_local_id(0);
          int group = item.get_group(0);
          int global_id = item.get_global_id(0) * elements_per_item;
          local[local_id] = 0.0;
          for (int i = global_id; i < std::min(n, global_id + elements_per_item); i++)
            local[local_id] += xcoefs[i] * ycoefs[i];
          for (int i = item.get_local_range(0) / 2; i > 0; i >>= 1) {
            item.barrier(cl::sycl::access::fence_space::local_space);
            if (local_id < i) local[local_id] += local[local_id + i];
          }
          if (local_id == 0) out_acc[group] += local[0];
        });
    });
  auto out = out_buff.template get_access<cl::sycl::access::mode::read>();
  magnitude result = 0.0;
  for (int i = 0; i < groups; i++) result += out[i];

#ifdef HAVE_MPI
  magnitude local_dot = result, global_dot = 0;
  MPI_Datatype mpi_dtype = TypeTraits<magnitude>::mpi_type();
  MPI_Allreduce(&local_dot, &global_dot, 1, mpi_dtype, MPI_SUM, MPI_COMM_WORLD);
  return global_dot;
#else
  return result;
#endif
}

template<typename Vector>
typename TypeTraits<typename Vector::ScalarType>::magnitude_type
dot_r2(cl::sycl::queue Queue, Vector& x)
{
  const MINIFE_LOCAL_ORDINAL n = x.coefs.size();

  typedef typename Vector::ScalarType Scalar;
  typedef typename TypeTraits<typename Vector::ScalarType>::magnitude_type magnitude;

  auto device = Queue.get_device();
  int items_per_group = device.get_info<cl::sycl::info::device::max_work_group_size>();
#if 0
  int groups = (n + items_per_group - 1) / items_per_group;
  int items = groups * items_per_group;
  int elements_per_item = 1;
#else
  int groups = 64;
  int items = groups * items_per_group;
  int elements_per_item = (n + items - 1) / items;
#endif
  cl::sycl::nd_range<1> ndRange(items, items_per_group);
  std::vector<magnitude> output(groups);
  for (int i = 0; i < groups; i++) output[i] = 0.0;
  cl::sycl::buffer<magnitude> out_buff(output.data(), cl::sycl::range<1>(groups));

  Queue.submit([&](cl::sycl::handler &cgh) {
      auto xcoefs = x.device_coefs.template get_access<cl::sycl::access::mode::read>(cgh);
      auto local = cl::sycl::accessor<float, 1, cl::sycl::access::mode::read_write, cl::sycl::access::target::local> (cl::sycl::range<1>(items_per_group),cgh);
      auto out_acc = out_buff.template get_access<cl::sycl::access::mode::write>(cgh);
      cgh.parallel_for<class dot_r2>(ndRange, [=](cl::sycl::nd_item<1> item) {
          int local_id = item.get_local_id(0);
          int group = item.get_group(0);
          int global_id = item.get_global_id(0) * elements_per_item;
          local[local_id] = 0.0;
          for (int i = global_id; i < std::min(n, global_id + elements_per_item); i++)
            local[local_id] += xcoefs[i] * xcoefs[i];
          for (int i = item.get_local_range(0) / 2; i > 0; i >>= 1) {
            item.barrier(cl::sycl::access::fence_space::local_space);
            if (local_id < i) local[local_id] += local[local_id + i];
          }
          if (local_id == 0) out_acc[group] += local[0];
        });
    });
  auto out = out_buff.template get_access<cl::sycl::access::mode::read>();
  magnitude result = 0.0;
  for (int i = 0; i < groups; i++) result += out[i];

#ifdef HAVE_MPI
  magnitude local_dot = result, global_dot = 0;
  MPI_Datatype mpi_dtype = TypeTraits<magnitude>::mpi_type();
  MPI_Allreduce(&local_dot, &global_dot, 1, mpi_dtype, MPI_SUM, MPI_COMM_WORLD);

#ifdef MINIFE_DEBUG_OPENMP
 	std::cout << "[" << myrank << "] Completed dot." << std::endl;
#endif

  return global_dot;
#else
#ifdef MINIFE_DEBUG_OPENMP
 	std::cout << "[" << myrank << "] Completed dot." << std::endl;
#endif
  return result;
#endif
}

}//namespace miniFE

#endif
